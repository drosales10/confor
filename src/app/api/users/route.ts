import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSchema, getUsersQuerySchema } from "@/validations/user.schema";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "users", "READ");
  if (permissionError) return permissionError;

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

  const { page, limit, search, status } = query.data;
  const where = {
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
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
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

  const permissionError = requirePermission(authResult.session.user.permissions, "users", "CREATE");
  if (permissionError) return permissionError;

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return fail("El usuario ya existe", 409);
  }

  const role = await prisma.role.findFirst({ where: { slug: parsed.data.roleSlug } });
  if (!role) {
    return fail("Rol no encontrado", 404);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      passwordHash,
      status: "ACTIVE",
      userRoles: {
        create: {
          roleId: role.id,
          assignedBy: authResult.session.user.id,
        },
      },
    },
    include: {
      userRoles: {
        include: { role: true },
      },
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
