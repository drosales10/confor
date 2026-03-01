import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { createUserSchema } from "@/validations/user.schema";
import { hashPassword } from "@/lib/crypto";
import { ensureRoleWithPermissions } from "@/lib/role-provisioning";
import crypto from "crypto";
import * as XLSX from "xlsx";

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

    if (ch === ',') {
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
  email: string;
  firstName?: string;
  lastName?: string;
  roleSlug: string;
  password?: string;
  organizationId?: string;
};

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "CREATE");
    if (permissionError) return permissionError;
  }

  const isSuperAdmin = roles.includes("SUPER_ADMIN");
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

    const required = ["email", "roleslug"];
    for (const key of required) {
      if (!headerIndex.has(key)) {
        return fail(`Falta columna obligatoria: ${key}`, 400);
      }
    }

    rows = parsed.rows.map((cols) => {
      const get = (key: string) => {
        const idx = headerIndex.get(key);
        return idx === undefined ? "" : String(cols[idx] ?? "").trim();
      };

      return {
        email: get("email"),
        firstName: get("firstname") || undefined,
        lastName: get("lastname") || undefined,
        roleSlug: get("roleslug"),
        password: get("password") || undefined,
        organizationId: get("organizationid") || undefined,
      };
    });
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
    if (jsonRows.length === 0) {
      rows = [];
    } else {
      const normalizedKeys = new Set<string>();
      Object.keys(jsonRows[0] ?? {}).forEach((key) => normalizedKeys.add(normalizeHeader(key)));
      const required = ["email", "roleslug"];
      for (const key of required) {
        if (!normalizedKeys.has(key)) {
          return fail(`Falta columna obligatoria: ${key}`, 400);
        }
      }

      const get = (record: Record<string, unknown>, target: string) => {
        const matchKey = Object.keys(record).find((k) => normalizeHeader(k) === target);
        const value = matchKey ? record[matchKey] : "";
        return String(value ?? "").trim();
      };

      rows = jsonRows
        .map((record) => {
          const email = get(record, "email");
          const roleSlug = get(record, "roleslug");
          return {
            email,
            firstName: get(record, "firstname") || undefined,
            lastName: get(record, "lastname") || undefined,
            roleSlug,
            password: get(record, "password") || undefined,
            organizationId: get(record, "organizationid") || undefined,
          } satisfies ImportRow;
        })
        .filter((row) => Boolean(row.email) || Boolean(row.roleSlug));
    }
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; email?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];

    const payload = {
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      roleSlug: row.roleSlug,
      password: row.password,
      organizationId: row.organizationId ?? (currentOrganizationId ?? undefined),
    };

    if (!isSuperAdmin && payload.organizationId !== currentOrganizationId) {
      errors.push({ row: rowNumber, email: row.email, error: "No puede asignar usuarios a otra organización" });
      skipped++;
      continue;
    }

    const parsed = createUserSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, email: row.email, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    if (!parsed.data.organizationId) {
      errors.push({ row: rowNumber, email: row.email, error: "La organización es obligatoria" });
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true, organizationId: true },
      });

      if (existing) {
        if (!isSuperAdmin && existing.organizationId !== currentOrganizationId) {
          errors.push({ row: rowNumber, email: row.email, error: "No puede modificar usuarios de otra organización" });
          skipped++;
          continue;
        }

        const role = await ensureRoleWithPermissions(parsed.data.roleSlug, parsed.data.organizationId);

        await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: parsed.data.firstName ?? undefined,
            lastName: parsed.data.lastName ?? undefined,
            organizationId: parsed.data.organizationId,
            userRoles: {
              updateMany: {
                where: { isActive: true },
                data: { isActive: false },
              },
              create: {
                roleId: role.id,
                assignedBy: authResult.session.user.id,
              },
            },
          },
        });

        updated++;
        continue;
      }

      const role = await ensureRoleWithPermissions(parsed.data.roleSlug, parsed.data.organizationId);

      const password = parsed.data.password ?? crypto.randomBytes(12).toString("base64url");
      const passwordHash = await hashPassword(password);

      await prisma.user.create({
        data: {
          email: parsed.data.email,
          firstName: parsed.data.firstName ?? null,
          lastName: parsed.data.lastName ?? null,
          passwordHash,
          status: parsed.data.password ? "ACTIVE" : "PENDING_VERIFICATION",
          organizationId: parsed.data.organizationId,
          userRoles: {
            create: {
              roleId: role.id,
              assignedBy: authResult.session.user.id,
            },
          },
        },
      });

      created++;
    } catch (err) {
      errors.push({ row: rowNumber, email: row.email, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
