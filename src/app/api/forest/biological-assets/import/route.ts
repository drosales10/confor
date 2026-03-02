import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          current += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === ",") {
      result.push(current);
      current = "";
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    current += ch;
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

async function resolveOrganizationId(sessionUser: { id?: string; organizationId?: string | null }) {
  if (sessionUser.organizationId !== undefined) {
    return sessionUser.organizationId;
  }

  if (!sessionUser.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { organizationId: true },
  });

  return user?.organizationId ?? null;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "si", "sí", "yes", "activo", "activa"].includes(normalized)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(normalized)) return false;
  return null;
}

function parseIntValue(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function parseDateValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

type ImportRow = {
  biologicalAssetKey: string;
  accountingKey?: string;
  assetType?: "COMERCIAL" | "INVESTIGACION";
  establishmentDate?: Date | null;
  plantingYear?: number | null;
  inventoryCode?: string;
  inventoryType?: string;
  inventoryDate?: Date | null;
  isActive?: boolean | null;
};

function parseAssetType(value: string): "COMERCIAL" | "INVESTIGACION" | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "COMERCIAL" || normalized === "INVESTIGACION") return normalized;
  return null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canCreate = hasPermission(permissions, "forest-biological-asset", "CREATE");
    const canUpdate = hasPermission(permissions, "forest-biological-asset", "UPDATE");
    if (!canCreate && !canUpdate) {
      const permissionError = requirePermission(permissions, "forest-biological-asset", "CREATE");
      if (permissionError) return permissionError;
    }
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const level4IdRaw = formData?.get("level4Id");
  const level4Id = typeof level4IdRaw === "string" ? level4IdRaw.trim() : "";

  if (!file || !(file instanceof File)) {
    return fail("Archivo requerido", 400);
  }

  if (!level4Id) {
    return fail("Nivel 4 requerido", 400);
  }

  const parent = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: level4Id,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
    select: { id: true },
  });

  if (!parent) {
    return fail("Nivel 4 no encontrado", 404);
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
    parsed.headers.forEach((header, index) => headerIndex.set(normalizeHeader(header), index));

    const required = ["biologicalassetkey"];
    for (const key of required) {
      if (!headerIndex.has(key)) {
        return fail(`Falta columna obligatoria: ${key}`, 400);
      }
    }

    rows = parsed.rows
      .map((cols) => {
        const get = (key: string) => {
          const index = headerIndex.get(key);
          return index === undefined ? "" : String(cols[index] ?? "").trim();
        };

        const assetType = parseAssetType(get("assettype"));

        return {
          biologicalAssetKey: get("biologicalassetkey"),
          accountingKey: get("accountingkey") || undefined,
          assetType: assetType ?? undefined,
          establishmentDate: parseDateValue(get("establishmentdate")),
          plantingYear: parseIntValue(get("plantingyear")),
          inventoryCode: get("inventorycode") || undefined,
          inventoryType: get("inventorytype") || undefined,
          inventoryDate: parseDateValue(get("inventorydate")),
          isActive: parseBoolean(get("isactive")),
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.biologicalAssetKey));
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
          const key = Object.keys(record).find((item) => normalizeHeader(item) === target);
          const value = key ? record[key] : "";
          return String(value ?? "").trim();
        };

        const assetType = parseAssetType(get("assettype"));

        return {
          biologicalAssetKey: get("biologicalassetkey"),
          accountingKey: get("accountingkey") || undefined,
          assetType: assetType ?? undefined,
          establishmentDate: parseDateValue(get("establishmentdate")),
          plantingYear: parseIntValue(get("plantingyear")),
          inventoryCode: get("inventorycode") || undefined,
          inventoryType: get("inventorytype") || undefined,
          inventoryDate: parseDateValue(get("inventorydate")),
          isActive: parseBoolean(get("isactive")),
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.biologicalAssetKey));
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; key?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2;
    const key = row.biologicalAssetKey.trim();

    if (!key) {
      errors.push({ row: rowNumber, key: row.biologicalAssetKey, error: "biologicalAssetKey es obligatorio" });
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.forestBiologicalAssetLevel6.findFirst({
        where: {
          level4Id,
          biologicalAssetKey: key,
          ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
        },
      });

      const rowData: Prisma.ForestBiologicalAssetLevel6UncheckedCreateInput = {
        level4Id,
        biologicalAssetKey: key,
        accountingKey: row.accountingKey ?? null,
        assetType: row.assetType ?? "COMERCIAL",
        establishmentDate: row.establishmentDate ?? null,
        plantingYear: row.plantingYear ?? null,
        inventoryCode: row.inventoryCode ?? null,
        inventoryType: row.inventoryType ?? null,
        inventoryDate: row.inventoryDate ?? null,
        isActive: row.isActive ?? true,
      };

      if (existing) {
        await prisma.forestBiologicalAssetLevel6.update({
          where: { id: existing.id },
          data: {
            accountingKey: rowData.accountingKey,
            assetType: rowData.assetType,
            establishmentDate: rowData.establishmentDate,
            plantingYear: rowData.plantingYear,
            inventoryCode: rowData.inventoryCode,
            inventoryType: rowData.inventoryType,
            inventoryDate: rowData.inventoryDate,
            isActive: row.isActive ?? existing.isActive,
          },
        });

        updated++;
        continue;
      }

      await prisma.forestBiologicalAssetLevel6.create({
        data: rowData,
      });

      created++;
    } catch (err) {
      errors.push({ row: rowNumber, key, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
