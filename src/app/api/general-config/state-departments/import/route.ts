import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stateDepartmentCreateSchema } from "@/validations/forest-config.schema";

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "si", "sí", "yes", "activo", "activa"].includes(normalized)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(normalized)) return false;
  return undefined;
}

type ImportRow = {
  id?: string;
  countryRef?: string;
  code: string;
  name: string;
  isActive?: boolean;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canCreate = hasPermission(permissions, "general-config", "CREATE");
    const canUpdate = hasPermission(permissions, "general-config", "UPDATE");
    if (!canCreate && !canUpdate) {
      const permissionError = requirePermission(permissions, "general-config", "CREATE");
      if (permissionError) return permissionError;
    }
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

    const hasAnyHeader = (...keys: string[]) => keys.some((key) => headerIndex.has(normalizeHeader(key)));

    if (!hasAnyHeader("code", "codigo", "código")) {
      return fail("Falta columna obligatoria: code/codigo", 400);
    }
    if (!hasAnyHeader("name", "nombre")) {
      return fail("Falta columna obligatoria: name/nombre", 400);
    }

    rows = parsed.rows
      .map((cols) => {
        const get = (...keys: string[]) => {
          for (const key of keys) {
            const idx = headerIndex.get(normalizeHeader(key));
            if (idx !== undefined) {
              return String(cols[idx] ?? "").trim();
            }
          }
          return "";
        };

        return {
          id: get("id") || undefined,
          countryRef: get("countryid", "countrycode", "countryname", "paisid", "paiscodigo", "paisnombre") || undefined,
          code: get("code", "codigo", "código"),
          name: get("name", "nombre"),
          isActive: parseBoolean(get("isactive", "activo")),
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || Boolean(row.name));
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
        const get = (...targets: string[]) => {
          for (const target of targets) {
            const normalizedTarget = normalizeHeader(target);
            const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === normalizedTarget);
            if (matchKey) {
              const value = record[matchKey];
              return String(value ?? "").trim();
            }
          }
          return "";
        };

        return {
          id: get("id") || undefined,
          countryRef: get("countryid", "countrycode", "countryname", "paisid", "paiscodigo", "paisnombre") || undefined,
          code: get("code", "codigo", "código"),
          name: get("name", "nombre"),
          isActive: parseBoolean(get("isactive", "activo")),
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || Boolean(row.name));
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; code?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const countries = await prisma.country.findMany({
    select: { id: true, code: true, name: true },
  });
  const countryByCode = new Map(countries.map((country) => [normalizeHeader(country.code), country.id]));
  const countryByName = new Map(countries.map((country) => [normalizeHeader(country.name), country.id]));

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    let resolvedCountryId: string | null = null;
    if (row.countryRef) {
      const ref = row.countryRef.trim();
      if (isUuid(ref)) {
        resolvedCountryId = ref;
      } else {
        const normalizedRef = normalizeHeader(ref);
        resolvedCountryId = countryByCode.get(normalizedRef) ?? countryByName.get(normalizedRef) ?? null;
      }
    }

    if (!resolvedCountryId) {
      errors.push({ row: rowNumber, code: row.code, error: "País inválido o no encontrado" });
      skipped++;
      continue;
    }

    const payload = {
      countryId: resolvedCountryId,
      code: row.code,
      name: row.name,
      isActive: row.isActive ?? true,
    };

    const parsed = stateDepartmentCreateSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, code: row.code, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    try {
      const existing = row.id
        ? await prisma.stateDepartment.findUnique({ where: { id: row.id } })
        : await prisma.stateDepartment.findFirst({
            where: {
              countryId: parsed.data.countryId,
              code: parsed.data.code,
            },
          });

      if (existing) {
        await prisma.stateDepartment.update({
          where: { id: existing.id },
          data: {
            countryId: parsed.data.countryId,
            code: parsed.data.code,
            name: parsed.data.name,
            isActive: parsed.data.isActive ?? existing.isActive,
          },
        });
        updated++;
        continue;
      }

      await prisma.stateDepartment.create({
        data: {
          countryId: parsed.data.countryId,
          code: parsed.data.code,
          name: parsed.data.name,
          isActive: parsed.data.isActive ?? true,
        },
      });
      created++;
    } catch (err) {
      errors.push({ row: rowNumber, code: row.code, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
