import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { vegetalMaterialCreateSchema } from "@/validations/forest-config.schema";

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

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "si", "sí", "yes", "activo", "activa"].includes(normalized)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(normalized)) return false;
  return undefined;
}

function normalizeEnum(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[-]/g, "_");
}

function parseMaterialType(value: string) {
  const normalized = normalizeEnum(value);
  if (normalized === "PURA" || normalized === "HIBRIDA") {
    return normalized as "PURA" | "HIBRIDA";
  }
  return undefined;
}

function parsePlantType(value: string) {
  const normalized = normalizeEnum(value);
  if (normalized === "PROGENIE" || normalized === "CLON" || normalized === "INJERTO" || normalized === "IN_VITRO") {
    return normalized as "PROGENIE" | "CLON" | "INJERTO" | "IN_VITRO";
  }
  return undefined;
}

function parsePlantOrigin(value: string) {
  const normalized = normalizeEnum(value);
  if (
    normalized === "NATIVA" ||
    normalized === "EXOTICA" ||
    normalized === "NATURALIZADA" ||
    normalized === "INTRODUCIDA" ||
    normalized === "ENDEMICA" ||
    normalized === "CULTIVADA"
  ) {
    return normalized as "NATIVA" | "EXOTICA" | "NATURALIZADA" | "INTRODUCIDA" | "ENDEMICA" | "CULTIVADA";
  }
  return undefined;
}

type ImportRow = {
  id?: string;
  code: string;
  name: string;
  speciesId?: string;
  speciesCode?: string;
  materialType?: "PURA" | "HIBRIDA";
  plantType?: "PROGENIE" | "CLON" | "INJERTO" | "IN_VITRO";
  plantOrigin?: "NATIVA" | "EXOTICA" | "NATURALIZADA" | "INTRODUCIDA" | "ENDEMICA" | "CULTIVADA";
  provenanceId?: string;
  provenanceCode?: string;
  isActive?: boolean;
  organizationId?: string;
};

async function resolveSpeciesId(speciesId: string | undefined, speciesCode: string | undefined, organizationId: string | null) {
  if (speciesId) {
    return speciesId;
  }

  if (!speciesCode) {
    return null;
  }

  const species = await prisma.species.findFirst({
    where: {
      code: speciesCode,
      organizationId,
    },
    select: { id: true },
  });

  return species?.id ?? null;
}

async function resolveProvenanceId(
  provenanceId: string | undefined,
  provenanceCode: string | undefined,
  organizationId: string | null,
) {
  if (provenanceId) {
    return provenanceId;
  }

  if (!provenanceCode) {
    return null;
  }

  const provenance = await prisma.provenance.findFirst({
    where: {
      code: provenanceCode,
      organizationId,
    },
    select: { id: true },
  });

  return provenance?.id ?? null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canCreate = hasPermission(permissions, "forest-config", "CREATE");
    const canUpdate = hasPermission(permissions, "forest-config", "UPDATE");
    if (!canCreate && !canUpdate) {
      const permissionError = requirePermission(permissions, "forest-config", "CREATE");
      if (permissionError) return permissionError;
    }
  }

  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !currentOrganizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
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

    const required = ["code", "name", "materialtype", "planttype", "plantorigin"];
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
          id: get("id") || undefined,
          code: get("code"),
          name: get("name"),
          speciesId: get("speciesid") || undefined,
          speciesCode: get("speciescode") || undefined,
          materialType: parseMaterialType(get("materialtype")),
          plantType: parsePlantType(get("planttype")),
          plantOrigin: parsePlantOrigin(get("plantorigin")),
          provenanceId: get("provenanceid") || undefined,
          provenanceCode: get("provenancecode") || undefined,
          isActive: parseBoolean(get("isactive")),
          organizationId: get("organizationid") || undefined,
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
        const get = (target: string) => {
          const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === target);
          const value = matchKey ? record[matchKey] : "";
          return String(value ?? "").trim();
        };

        return {
          id: get("id") || undefined,
          code: get("code"),
          name: get("name"),
          speciesId: get("speciesid") || undefined,
          speciesCode: get("speciescode") || undefined,
          materialType: parseMaterialType(get("materialtype")),
          plantType: parsePlantType(get("planttype")),
          plantOrigin: parsePlantOrigin(get("plantorigin")),
          provenanceId: get("provenanceid") || undefined,
          provenanceCode: get("provenancecode") || undefined,
          isActive: parseBoolean(get("isactive")),
          organizationId: get("organizationid") || undefined,
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

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    const targetOrganizationId = isSuperAdmin
      ? row.organizationId ?? currentOrganizationId ?? null
      : currentOrganizationId ?? null;

    if (!isSuperAdmin && row.organizationId && row.organizationId !== currentOrganizationId) {
      errors.push({ row: rowNumber, code: row.code, error: "No puede importar registros en otra organización" });
      skipped++;
      continue;
    }

    const resolvedSpeciesId = await resolveSpeciesId(row.speciesId, row.speciesCode, targetOrganizationId);
    if (!resolvedSpeciesId) {
      errors.push({ row: rowNumber, code: row.code, error: "Especie inválida o no encontrada" });
      skipped++;
      continue;
    }

    const resolvedProvenanceId = await resolveProvenanceId(row.provenanceId, row.provenanceCode, targetOrganizationId);
    if ((row.provenanceId || row.provenanceCode) && !resolvedProvenanceId) {
      errors.push({ row: rowNumber, code: row.code, error: "Procedencia inválida o no encontrada" });
      skipped++;
      continue;
    }

    const payload = {
      code: row.code,
      name: row.name,
      speciesId: resolvedSpeciesId,
      materialType: row.materialType,
      plantType: row.plantType,
      plantOrigin: row.plantOrigin,
      provenanceId: resolvedProvenanceId,
      isActive: row.isActive ?? true,
    };

    const parsed = vegetalMaterialCreateSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, code: row.code, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    try {
      const existing = row.id
        ? await prisma.vegetalMaterial.findFirst({
            where: {
              id: row.id,
              organizationId: targetOrganizationId,
            },
          })
        : await prisma.vegetalMaterial.findFirst({
            where: {
              code: parsed.data.code,
              organizationId: targetOrganizationId,
            },
          });

      if (existing) {
        await prisma.vegetalMaterial.update({
          where: { id: existing.id },
          data: {
            code: parsed.data.code,
            name: parsed.data.name,
            speciesId: parsed.data.speciesId,
            materialType: parsed.data.materialType,
            plantType: parsed.data.plantType,
            plantOrigin: parsed.data.plantOrigin,
            provenanceId: parsed.data.provenanceId ?? null,
            isActive: parsed.data.isActive ?? existing.isActive,
          },
        });
        updated++;
        continue;
      }

      await prisma.vegetalMaterial.create({
        data: {
          organizationId: targetOrganizationId,
          code: parsed.data.code,
          name: parsed.data.name,
          speciesId: parsed.data.speciesId,
          materialType: parsed.data.materialType,
          plantType: parsed.data.plantType,
          plantOrigin: parsed.data.plantOrigin,
          provenanceId: parsed.data.provenanceId ?? null,
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
