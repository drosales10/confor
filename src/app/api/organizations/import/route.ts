import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrganizationSchema } from "@/validations/organization.schema";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { generateSlug } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

function canManageOrganizations(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        const next = line[index + 1];
        if (next === '"') {
          current += '"';
          index++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      current += char;
      continue;
    }

    if (char === ",") {
      result.push(current);
      current = "";
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r\n|\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

type ImportRow = {
  name: string;
  rif: string;
  countryId?: string;
};

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (!canManageOrganizations(roles)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "CREATE");
    if (permissionError) return permissionError;
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return fail("Archivo requerido", 400);
  }

  const filename = file.name ?? "";
  const ext = filename.toLowerCase().endsWith(".xlsx") ? "xlsx" : filename.toLowerCase().endsWith(".csv") ? "csv" : null;
  if (!ext) {
    return fail("Formato inválido", 400);
  }

  let rows: ImportRow[] = [];

  if (ext === "csv") {
    const content = await file.text();
    const parsed = parseCsv(content);

    const headerIndex = new Map<string, number>();
    parsed.headers.forEach((header, idx) => headerIndex.set(normalizeHeader(header), idx));

    const required = ["name", "rif"];
    for (const key of required) {
      if (!headerIndex.has(key)) {
        return fail(`Falta columna obligatoria: ${key}`, 400);
      }
    }

    rows = parsed.rows
      .map((cols) => {
        const get = (key: string) => {
          const idx = headerIndex.get(key);
          return idx === undefined ? "" : String(cols[idx] ?? "").trim();
        };

        return {
          name: get("name"),
          rif: get("rif"),
          countryId: get("countryid") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.name) || Boolean(row.rif));
  }

  if (ext === "xlsx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!worksheet) {
      return fail("El archivo no contiene hojas", 400);
    }

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    rows = jsonRows
      .map((record) => {
        const get = (target: string) => {
          const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === target);
          const value = matchKey ? record[matchKey] : "";
          return String(value ?? "").trim();
        };

        return {
          name: get("name"),
          rif: get("rif"),
          countryId: get("countryid") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.name) || Boolean(row.rif));
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; name?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    const payload = {
      name: row.name,
      rif: row.rif,
      countryId: row.countryId ?? "",
    };

    const parsed = createOrganizationSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, name: row.name, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    try {
      const slug = generateSlug(parsed.data.name);
      const existing = await prisma.organization.findFirst({
        where: {
          slug,
          deletedAt: null,
        },
      });

      if (existing) {
        await prisma.organization.update({
          where: { id: existing.id },
          data: {
            name: parsed.data.name,
            countryId: parsed.data.countryId || null,
            settings: { rif: parsed.data.rif } as Prisma.InputJsonValue,
          },
        });
        updated++;
        continue;
      }

      await prisma.organization.create({
        data: {
          name: parsed.data.name,
          slug,
          countryId: parsed.data.countryId || null,
          settings: { rif: parsed.data.rif } as Prisma.InputJsonValue,
        },
      });
      created++;
    } catch (err) {
      errors.push({ row: rowNumber, name: row.name, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
