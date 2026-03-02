import { NextRequest } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const validTypes = ["STRING", "INTEGER", "BOOLEAN", "JSON", "SECRET"] as const;

const importSchema = z.object({
  category: z.string().trim().min(1),
  key: z.string().trim().min(1),
  value: z.string().nullable().optional(),
  configType: z.enum(validTypes).default("STRING"),
  isPublic: z.boolean().default(false),
  isEditable: z.boolean().default(true),
});

type ParsedRow = Record<string, unknown>;

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function parseRowsFromFile(fileName: string, buffer: Buffer): ParsedRow[] {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as ParsedRow[];
  }

  if (extension === "xlsx") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as ParsedRow[];
  }

  throw new Error("Formato no soportado. Use .csv o .xlsx");
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const roles = authResult.session.user.roles ?? [];
    const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    if (!isAdmin) {
      const permissionError = requirePermission(authResult.session.user.permissions ?? [], "settings", "UPDATE");
      if (permissionError) return permissionError;
    }

    const organizationId = authResult.session.user.organizationId ?? null;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("Debe adjuntar un archivo", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawRows = parseRowsFromFile(file.name, buffer);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; key?: string; error: string }> = [];

    for (const [index, row] of rawRows.entries()) {
      const mapped: Record<string, unknown> = {};

      for (const [header, value] of Object.entries(row)) {
        const normalized = normalizeHeader(header);
        if (["category", "categoria"].includes(normalized)) mapped.category = value;
        if (["key", "clave"].includes(normalized)) mapped.key = value;
        if (["value", "valor"].includes(normalized)) mapped.value = value;
        if (["configtype", "tipo", "tipo_configuracion", "tipoconfiguracion"].includes(normalized)) mapped.configType = value;
        if (["ispublic", "publico", "espublico", "public"].includes(normalized)) mapped.isPublic = value;
        if (["iseditable", "editable", "eseditable"].includes(normalized)) mapped.isEditable = value;
      }

      const rawConfigType =
        mapped.configType === null || mapped.configType === undefined
          ? ""
          : String(mapped.configType).trim().toUpperCase();

      const candidate = {
        category: typeof mapped.category === "string" ? mapped.category : String(mapped.category ?? ""),
        key: typeof mapped.key === "string" ? mapped.key : String(mapped.key ?? ""),
        value:
          mapped.value === null || mapped.value === undefined
            ? null
            : typeof mapped.value === "string"
              ? mapped.value
              : String(mapped.value),
        configType: validTypes.includes(rawConfigType as (typeof validTypes)[number])
          ? (rawConfigType as (typeof validTypes)[number])
          : "STRING",
        isPublic: parseBoolean(mapped.isPublic, false),
        isEditable: parseBoolean(mapped.isEditable, true),
      };

      const parsed = importSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({
          row: index + 2,
          key: candidate.key,
          error: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
        skipped += 1;
        continue;
      }

      try {
        const existing = await prisma.systemConfiguration.findFirst({
          where: {
            organizationId,
            category: parsed.data.category,
            key: parsed.data.key,
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.systemConfiguration.update({
            where: { id: existing.id },
            data: {
              value: parsed.data.value,
              configType: parsed.data.configType,
              isPublic: parsed.data.isPublic,
              isEditable: parsed.data.isEditable,
              updatedBy: authResult.session.user.id,
            },
          });
        } else {
          await prisma.systemConfiguration.create({
            data: {
              organizationId,
              category: parsed.data.category,
              key: parsed.data.key,
              value: parsed.data.value,
              configType: parsed.data.configType,
              isPublic: parsed.data.isPublic,
              isEditable: parsed.data.isEditable,
              updatedBy: authResult.session.user.id,
            },
          });
        }

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      } catch (error) {
        errors.push({
          row: index + 2,
          key: candidate.key,
          error: error instanceof Error ? error.message : "Error al guardar registro",
        });
        skipped += 1;
      }
    }

    return ok({
      totalRows: rawRows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible procesar la importación";
    return fail(message, 500);
  }
}
