import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  deleteByIdSchema,
  forestConfigQuerySchema,
  stateDepartmentCreateSchema,
  stateDepartmentUpdateSchema,
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
    if (error.code === "P2002") return fail("Ya existe un registro con ese código en el país", 409);
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
    prisma.stateDepartment.count({ where }),
    prisma.stateDepartment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ name: "asc" }],
      include: {
        country: { select: { id: true, code: true, name: true } },
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
  const parsed = stateDepartmentCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const country = await prisma.country.findUnique({ where: { id: parsed.data.countryId } });
  if (!country) return fail("País no encontrado", 404);

  try {
    const created = await prisma.stateDepartment.create({
      data: {
        countryId: parsed.data.countryId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        country: { select: { id: true, code: true, name: true } },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "StateDepartment",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear el estado/departamento");
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
  const parsed = stateDepartmentUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  if (parsed.data.countryId) {
    const country = await prisma.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return fail("País no encontrado", 404);
  }

  try {
    const updated = await prisma.stateDepartment.update({
      where: { id: parsed.data.id },
      data: {
        countryId: parsed.data.countryId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
      include: {
        country: { select: { id: true, code: true, name: true } },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "StateDepartment",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar el estado/departamento");
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

  const municipalityCount = await prisma.municipalityDistrict.count({ where: { stateId: parsed.data.id } });
  if (municipalityCount > 0) {
    return fail("No se puede eliminar el estado/departamento porque tiene municipios relacionados", 409);
  }

  try {
    await prisma.stateDepartment.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "StateDepartment",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar el estado/departamento");
  }
}
