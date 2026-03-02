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

type ImportRow = {
  name: string;
  slug: string;
  description?: string;
  organizationId?: string;
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

    const required = ["name", "slug"];
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
          slug: get("slug"),
          description: get("description") || undefined,
          organizationId: get("organizationid") || undefined,
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
        const get = (target: string) => {
          const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === target);
          const value = matchKey ? record[matchKey] : "";
          return String(value ?? "").trim();
        };

        return {
          name: get("name"),
          slug: get("slug"),
          description: get("description") || undefined,
          organizationId: get("organizationid") || undefined,
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

    const organizationId = row.organizationId || defaultOrganizationId;

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
