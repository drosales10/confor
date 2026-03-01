import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSchema, getUsersQuerySchema } from "@/validations/user.schema";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/crypto";
import crypto from "crypto";
import { ensureRoleWithPermissions } from "@/lib/role-provisioning";

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

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "users", "READ");
    if (permissionError) return permissionError;
  }

  const searchParams = req.nextUrl.searchParams;
  const query = getUsersQuerySchema.safeParse({
    page: searchParams.get("page") ?? 1,
    limit: searchParams.get("limit") ?? 25,
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    role: searchParams.get("role") ?? undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortOrder: searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { page, limit, search, status, role, sortBy, sortOrder } = query.data;

  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const requestedOrganizationId = searchParams.get("organizationId");
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

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        userRoles: {
          where: { isActive: true },
          include: {
            role: true,
          },
        },
        organization: true,
      },
    }),
  ]);

  return ok({
    items: users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "users", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  if (!parsed.data.organizationId) {
    return fail("La organización es obligatoria", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return fail("El usuario ya existe", 409);
  }

  const role = await ensureRoleWithPermissions(parsed.data.roleSlug, parsed.data.organizationId);

  const password = parsed.data.password ?? crypto.randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
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
    include: {
      userRoles: {
        where: { isActive: true },
        include: { role: true },
      },
      organization: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      newValues: {
        email: user.email,
      },
    },
  });

  return ok(user, 201);
}
