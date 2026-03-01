import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { z } from "zod";
import * as XLSX from "xlsx";

function resolveExportMaxLimit() {
  const raw = process.env.USERS_EXPORT_MAX_LIMIT;
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

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
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
    status: z.enum(["ACTIVE", "INACTIVE", "LOCKED", "PENDING_VERIFICATION", "DELETED"]).optional(),
    role: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });

  const query = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? 100,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    role: req.nextUrl.searchParams.get("role") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { limit: requestedLimit, search, status, role, sortBy, sortOrder } = query.data;
  const limit = Math.min(requestedLimit, exportMaxLimit);

  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const requestedOrganizationId = req.nextUrl.searchParams.get("organizationId");
  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !currentOrganizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const organizationScope = isSuperAdmin
    ? requestedOrganizationId
      ? { organizationId: requestedOrganizationId }
      : {}
    : { organizationId: currentOrganizationId ?? "" };

  const where = {
    ...organizationScope,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role
      ? {
          userRoles: {
            some: {
              isActive: true,
              role: { slug: role },
            },
          },
        }
      : {}),
  };

  const orderDirection = sortOrder === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "email"
      ? ({ email: orderDirection } as const)
      : sortBy === "status"
        ? ({ status: orderDirection } as const)
        : sortBy === "createdAt"
          ? ({ createdAt: orderDirection } as const)
          : ({ createdAt: "desc" } as const);

  const users = await prisma.user.findMany({
    where,
    orderBy,
    take: limit,
    include: {
      userRoles: {
        where: { isActive: true },
        include: { role: true },
      },
      organization: true,
    },
  });

  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const headers = [
      "email",
      "firstName",
      "lastName",
      "status",
      "roleSlug",
      "organizationId",
      "organizationName",
      "createdAt",
    ];

    const rows = users.map((user) => {
      const roleSlug = user.userRoles?.[0]?.role?.slug ?? "";
      return [
        user.email,
        user.firstName ?? "",
        user.lastName ?? "",
        user.status,
        roleSlug,
        user.organizationId ?? "",
        user.organization?.name ?? "",
        user.createdAt.toISOString(),
      ];
    });

    const csv = [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users_${filenameDate}.csv"`,
      },
    });
  }

  const rows = users.map((user) => ({
    Email: user.email,
    Nombres: user.firstName ?? "",
    Apellidos: user.lastName ?? "",
    Estatus: user.status,
    Rol: user.userRoles?.[0]?.role?.slug ?? "",
    "Organización ID": user.organizationId ?? "",
    Organización: user.organization?.name ?? "",
    Fecha: user.createdAt.toISOString(),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Email",
      "Nombres",
      "Apellidos",
      "Estatus",
      "Rol",
      "Organización ID",
      "Organización",
      "Fecha",
    ],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"users_${filenameDate}.xlsx\"`,
    },
  });
}
