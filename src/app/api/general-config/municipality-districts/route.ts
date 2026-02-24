import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  deleteByIdSchema,
  forestConfigQuerySchema,
  municipalityDistrictCreateSchema,
  municipalityDistrictUpdateSchema,
} from "@/validations/forest-config.schema";

async function safeAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
  try {
    await prisma.auditLog.create({ data });
  } catch {}
}

function ensureReadPermission(permissions: string[], isSuperAdmin: boolean) {
  if (isSuperAdmin) return null;

  const canReadGeneralConfig = hasPermission(permissions, "general-config", "READ");
  const canWriteGeneralConfig = ["CREATE", "UPDATE", "DELETE"].some((action) =>
    hasPermission(permissions, "general-config", action),
  );

  if (!canReadGeneralConfig && !canWriteGeneralConfig) {
    return requirePermission(permissions, "general-config", "READ");
  }

  return null;
}

function mapPrismaError(error: unknown, message: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return fail("Ya existe un registro con ese código en el estado/departamento", 409);
    if (error.code === "P2003") return fail("No se pudo completar por una relación inválida", 400);
    if (error.code === "P2025") return fail("Registro no encontrado", 404);
  }

  return fail(message, 500);
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  const permissionError = ensureReadPermission(authResult.session.user.permissions ?? [], isSuperAdmin);
  if (permissionError) return permissionError;

  const query = forestConfigQuerySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? 1,
    limit: req.nextUrl.searchParams.get("limit") ?? 200,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) return fail("Parámetros inválidos", 400, query.error.flatten());

  const { page, limit, search } = query.data;

  const where = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, items] = await Promise.all([
    prisma.municipalityDistrict.count({ where }),
    prisma.municipalityDistrict.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ name: "asc" }],
      include: {
        state: {
          select: {
            id: true,
            code: true,
            name: true,
            country: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
  ]);

  return ok({
    items,
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

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "general-config", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = municipalityDistrictCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const state = await prisma.stateDepartment.findUnique({ where: { id: parsed.data.stateId } });
  if (!state) return fail("Estado/departamento no encontrado", 404);

  try {
    const created = await prisma.municipalityDistrict.create({
      data: {
        stateId: parsed.data.stateId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        state: {
          select: {
            id: true,
            code: true,
            name: true,
            country: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "MunicipalityDistrict",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear el municipio/distrito");
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "general-config", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = municipalityDistrictUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  if (parsed.data.stateId) {
    const state = await prisma.stateDepartment.findUnique({ where: { id: parsed.data.stateId } });
    if (!state) return fail("Estado/departamento no encontrado", 404);
  }

  try {
    const updated = await prisma.municipalityDistrict.update({
      where: { id: parsed.data.id },
      data: {
        stateId: parsed.data.stateId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
      include: {
        state: {
          select: {
            id: true,
            code: true,
            name: true,
            country: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "MunicipalityDistrict",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar el municipio/distrito");
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "general-config", "DELETE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = deleteByIdSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const cityCount = await prisma.city.count({ where: { municipalityId: parsed.data.id } });
  if (cityCount > 0) {
    return fail("No se puede eliminar el municipio/distrito porque tiene ciudades relacionadas", 409);
  }

  try {
    await prisma.municipalityDistrict.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "MunicipalityDistrict",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar el municipio/distrito");
  }
}
