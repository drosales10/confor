import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { landUseTypeCreateSchema } from "@/validations/forest-config.schema";

const LAND_USE_CATEGORIES = [
  "BOSQUE",
  "NO BOSQUE",
  "BOSQUE DEFORESTADO",
  "BOSQUE DEGRADADO",
  "CUERPOS DE AGUA",
  "SUELO DESNUDO",
  "INFRAESTRUCTURA",
] as const;

type LandUseCategory = (typeof LAND_USE_CATEGORIES)[number];

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
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
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

function parseCategory(value: string): LandUseCategory | undefined {
  const normalized = value.trim().toUpperCase();
  if (LAND_USE_CATEGORIES.includes(normalized as LandUseCategory)) {
    return normalized as LandUseCategory;
  }
  return undefined;
}

type ImportRow = {
  id?: string;
  code: string;
  name?: string;
  category?: LandUseCategory;
  isProductive?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  organizationId?: string;
};

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

    if (!headerIndex.has("code")) {
      return fail("Falta columna obligatoria: code", 400);
    }

    const hasName = headerIndex.has("name") || headerIndex.has("nombre");
    if (!hasName) {
      return fail("Falta columna obligatoria: name", 400);
    }

    const hasCategory = headerIndex.has("category") || headerIndex.has("categoria");
    if (!hasCategory) {
      return fail("Falta columna obligatoria: category", 400);
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
          name: get("name") || get("nombre") || undefined,
          category: parseCategory(get("category") || get("categoria")),
          isProductive: parseBoolean(get("isproductive")),
          isActive: parseBoolean(get("isactive")),
          createdAt: get("createdat") || undefined,
          updatedAt: get("updatedat") || undefined,
          organizationId: get("organizationid") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || Boolean(row.name) || Boolean(row.category));
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
          name: get("name") || get("nombre") || undefined,
          category: parseCategory(get("category") || get("categoria")),
          isProductive: parseBoolean(get("isproductive")),
          isActive: parseBoolean(get("isactive")),
          createdAt: get("createdat") || undefined,
          updatedAt: get("updatedat") || undefined,
          organizationId: get("organizationid") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || Boolean(row.name) || Boolean(row.category));
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

    const payload = {
      code: row.code,
      name: row.name,
      category: row.category,
      isProductive: row.isProductive ?? false,
      isActive: row.isActive ?? true,
    };

    const parsed = landUseTypeCreateSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, code: row.code, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    if (!isSuperAdmin && row.organizationId && row.organizationId !== currentOrganizationId) {
      errors.push({ row: rowNumber, code: row.code, error: "No puede importar registros en otra organización" });
      skipped++;
      continue;
    }

    try {
      const existing = row.id
        ? await prisma.landUseType.findFirst({
            where: {
              id: row.id,
              organizationId: targetOrganizationId,
            },
          })
        : await prisma.landUseType.findFirst({
            where: {
              code: parsed.data.code,
              organizationId: targetOrganizationId,
            },
          });

      if (existing) {
        await prisma.landUseType.update({
          where: { id: existing.id },
          data: {
            continentId: null,
            code: parsed.data.code,
            name: parsed.data.name,
            category: parsed.data.category,
            isProductive: parsed.data.isProductive ?? existing.isProductive,
            isActive: parsed.data.isActive ?? existing.isActive,
          },
        });
        updated++;
        continue;
      }

      await prisma.landUseType.create({
        data: {
          organizationId: targetOrganizationId,
          continentId: null,
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          isProductive: parsed.data.isProductive ?? false,
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
