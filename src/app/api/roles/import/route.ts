import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function canManageRoles(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

function normalizeRoleSlug(slug: string) {
  return slug.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "_");
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

type ImportRow = {
  name: string;
  slug: string;
  description?: string;
  organizationRef?: string;
};

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const sessionRoles = authResult.session.user.roles ?? [];
  const isAdmin = canManageRoles(sessionRoles);
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "CREATE");
    if (permissionError) return permissionError;
  }

  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return fail("Archivo requerido", 400);
  }

  const requestedOrganizationIdRaw = formData?.get("organizationId");
  const requestedOrganizationId = typeof requestedOrganizationIdRaw === "string" ? requestedOrganizationIdRaw.trim() : "";
  const defaultOrganizationId = isAdmin ? requestedOrganizationId || currentOrganizationId || undefined : currentOrganizationId || undefined;

  if (!defaultOrganizationId && !isAdmin) {
    return fail("El usuario no tiene una organización asociada", 403);
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
    if (!hasAnyHeader("slug")) {
      return fail("Falta columna obligatoria: slug", 400);
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
          slug: get("slug"),
          description: get("description", "descripcion", "descripción") || undefined,
          organizationRef: get("organizationid", "organization", "organizacionid", "organizacion", "organizaciónid", "organización") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.name) || Boolean(row.slug));
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
          slug: get("slug"),
          description: get("description", "descripcion", "descripción") || undefined,
          organizationRef: get("organizationid", "organization", "organizacionid", "organizacion", "organizaciónid", "organización") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.name) || Boolean(row.slug));
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; slug?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization.id]));
  const organizationByName = new Map(organizations.map((organization) => [normalizeHeader(organization.name), organization.id]));
  const organizationBySlug = new Map(organizations.map((organization) => [normalizeHeader(organization.slug), organization.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const name = row.name.trim();
    const normalizedSlug = normalizeRoleSlug(row.slug);

    if (!name || !normalizedSlug) {
      errors.push({ row: rowNumber, slug: row.slug, error: "name y slug son obligatorios" });
      skipped++;
      continue;
    }

    let organizationId = defaultOrganizationId;
    if (row.organizationRef) {
      const ref = row.organizationRef.trim();
      if (isUuid(ref) && organizationById.has(ref)) {
        organizationId = ref;
      } else {
        const normalizedRef = normalizeHeader(ref);
        organizationId = organizationByName.get(normalizedRef) ?? organizationBySlug.get(normalizedRef) ?? organizationId;
      }
    }

    if (!organizationId && !isAdmin) {
      errors.push({ row: rowNumber, slug: normalizedSlug, error: "No se pudo resolver organizationId" });
      skipped++;
      continue;
    }

    if (!isAdmin && organizationId !== currentOrganizationId) {
      errors.push({ row: rowNumber, slug: normalizedSlug, error: "No puede importar roles en otra organización" });
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.role.findFirst({
        where: {
          slug: normalizedSlug,
          organizationId: organizationId ?? null,
          isActive: true,
        },
      });

      if (existing) {
        if (existing.isSystemRole) {
          errors.push({ row: rowNumber, slug: normalizedSlug, error: "No se puede modificar un rol del sistema" });
          skipped++;
          continue;
        }

        await prisma.role.update({
          where: { id: existing.id },
          data: {
            name,
            description: row.description?.trim() || null,
          },
        });

        updated++;
        continue;
      }

      await prisma.role.create({
        data: {
          name,
          slug: normalizedSlug,
          description: row.description?.trim() || null,
          organizationId: organizationId ?? null,
          isSystemRole: false,
          isActive: true,
        },
      });

      created++;
    } catch (err) {
      errors.push({ row: rowNumber, slug: normalizedSlug, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
