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

function isSuperAdmin(roles: string[]) {
  return roles.includes("SUPER_ADMIN");
}

function isScopedAdmin(roles: string[]) {
  return roles.includes("ADMIN") && !isSuperAdmin(roles);
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  countryRef?: string;
};

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (isScopedAdmin(roles)) {
    return fail("Un usuario ADMIN solo puede ver y editar su propia organización", 403);
  }

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

    const hasAnyHeader = (...keys: string[]) => keys.some((key) => headerIndex.has(normalizeHeader(key)));

    if (!hasAnyHeader("name", "nombre")) {
      return fail("Falta columna obligatoria: name/nombre", 400);
    }
    if (!hasAnyHeader("rif")) {
      return fail("Falta columna obligatoria: rif", 400);
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
          name: get("name", "nombre"),
          rif: get("rif"),
          countryRef: get("countryid", "country", "countryname", "pais", "país") || undefined,
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
          name: get("name", "nombre"),
          rif: get("rif"),
          countryRef: get("countryid", "country", "countryname", "pais", "país") || undefined,
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

  const countryRefs = Array.from(
    new Set(
      rows
        .map((row) => row.countryRef?.trim())
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase())
    )
  );

  const countries =
    countryRefs.length > 0
      ? await prisma.country.findMany({
          select: { id: true, name: true, code: true },
        })
      : [];

  const countryByNormalizedName = new Map(countries.map((country) => [normalizeHeader(country.name), country.id]));
  const countryByNormalizedCode = new Map(countries.map((country) => [normalizeHeader(country.code), country.id]));

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    let resolvedCountryId = "";
    if (row.countryRef) {
      const ref = row.countryRef.trim();
      if (isUuid(ref)) {
        resolvedCountryId = ref;
      } else {
        const normalizedRef = normalizeHeader(ref);
        resolvedCountryId = countryByNormalizedName.get(normalizedRef) ?? countryByNormalizedCode.get(normalizedRef) ?? "";
      }
    }

    const payload = {
      name: row.name,
      rif: row.rif,
      countryId: resolvedCountryId,
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
