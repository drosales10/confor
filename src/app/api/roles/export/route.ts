import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { z } from "zod";
import * as XLSX from "xlsx";

const sortKeys = ["name", "slug", "organizationName", "isSystemRole", "permissionsCount"] as const;
type SortKey = (typeof sortKeys)[number];

function canManageRoles(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

function resolveExportMaxLimit() {
  const raw = process.env.ROLES_EXPORT_MAX_LIMIT;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.floor(parsed);
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

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

type RoleExportRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizationId: string;
  organizationName: string;
  isSystemRole: boolean;
  permissionsCount: number;
};

function sortRows(rows: RoleExportRow[], sortBy: SortKey, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    if (sortBy === "isSystemRole") {
      return ((left.isSystemRole ? 1 : 0) - (right.isSystemRole ? 1 : 0)) * direction;
    }

    if (sortBy === "permissionsCount") {
      return (left.permissionsCount - right.permissionsCount) * direction;
    }

    const leftValue =
      sortBy === "organizationName"
        ? left.organizationName
        : sortBy === "slug"
          ? left.slug
          : left.name;

    const rightValue =
      sortBy === "organizationName"
        ? right.organizationName
        : sortBy === "slug"
          ? right.slug
          : right.name;

    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "es", { sensitivity: "base" }) * direction;
  });
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rolesFromSession = authResult.session.user.roles ?? [];
  const isAdmin = canManageRoles(rolesFromSession);
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "EXPORT");
    if (permissionError) return permissionError;
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx") {
    return fail("Formato inválido", 400);
  }

  const exportMaxLimit = resolveExportMaxLimit();
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(exportMaxLimit).default(100),
    search: z.string().optional(),
    sortBy: z.enum(sortKeys).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  });

  const query = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? 100,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "name",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "asc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { limit: requestedLimit, search, sortBy, sortOrder } = query.data;
  const limit = Math.min(requestedLimit, exportMaxLimit);

  const requestedOrganizationId = req.nextUrl.searchParams.get("organizationId");
  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const canCrossOrganizations = isAdmin;

  const roleScope = requestedOrganizationId
    ? { OR: [{ organizationId: requestedOrganizationId }, { organizationId: null }] }
    : currentOrganizationId && !canCrossOrganizations
      ? { OR: [{ organizationId: currentOrganizationId }, { organizationId: null }] }
      : currentOrganizationId && canCrossOrganizations
        ? { OR: [{ organizationId: currentOrganizationId }, { organizationId: null }] }
        : { organizationId: null as string | null };

  const dbRoles = await prisma.role.findMany({
    where: { isActive: true, ...roleScope },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
      rolePermissions: {
        select: {
          permissionId: true,
        },
      },
    },
  });

  const dedupedRolesBySlug = new Map<string, (typeof dbRoles)[number]>();
  for (const role of dbRoles) {
    const existing = dedupedRolesBySlug.get(role.slug);
    if (!existing) {
      dedupedRolesBySlug.set(role.slug, role);
      continue;
    }

    const existingMatchesOrg = existing.organizationId === currentOrganizationId;
    const candidateMatchesOrg = role.organizationId === currentOrganizationId;
    if (!existingMatchesOrg && candidateMatchesOrg) {
      dedupedRolesBySlug.set(role.slug, role);
    }
  }

  const normalizedSearch = search?.trim().toLowerCase() ?? "";

  const rows = Array.from(dedupedRolesBySlug.values())
    .map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description ?? "",
      organizationId: role.organizationId ?? "",
      organizationName: role.organization?.name ?? "Global",
      isSystemRole: role.isSystemRole,
      permissionsCount: role.rolePermissions.length,
    }))
    .filter((row) => {
      if (!normalizedSearch) return true;
      return (
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.slug.toLowerCase().includes(normalizedSearch) ||
        row.organizationName.toLowerCase().includes(normalizedSearch)
      );
    });

  const sorted = sortRows(rows, sortBy, sortOrder).slice(0, limit);
  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const headers = [
      "name",
      "slug",
      "description",
      "organizationId",
      "organizationName",
      "isSystemRole",
      "permissionsCount",
    ];

    const csv = [
      headers.join(","),
      ...sorted.map((row) =>
        [
          row.name,
          row.slug,
          row.description,
          row.organizationId,
          row.organizationName,
          row.isSystemRole ? "true" : "false",
          row.permissionsCount,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="roles_${filenameDate}.csv"`,
      },
    });
  }

  const worksheetRows = sorted.map((row) => ({
    Nombre: row.name,
    Slug: row.slug,
    Descripción: row.description,
    "Organización ID": row.organizationId,
    Organización: row.organizationName,
    "Rol del sistema": row.isSystemRole ? "Sí" : "No",
    Permisos: row.permissionsCount,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: ["Nombre", "Slug", "Descripción", "Organización ID", "Organización", "Rol del sistema", "Permisos"],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Roles");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roles_${filenameDate}.xlsx"`,
    },
  });
}
