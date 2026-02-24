import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  deleteByIdSchema,
  forestConfigQuerySchema,
  speciesCreateSchema,
  speciesUpdateSchema,
} from "@/validations/forest-config.schema";

async function safeAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
  try {
    await prisma.auditLog.create({ data });
  } catch {}
}

function ensureReadPermission(permissions: string[], isSuperAdmin: boolean) {
  if (isSuperAdmin) return null;

  const canReadForestConfig = hasPermission(permissions, "forest-config", "READ");
  const canWriteForestConfig = ["CREATE", "UPDATE", "DELETE"].some((action) =>
    hasPermission(permissions, "forest-config", action),
  );

  if (!canReadForestConfig && !canWriteForestConfig) {
    return requirePermission(permissions, "forest-config", "READ");
  }

  return null;
}

function mapPrismaError(error: unknown, message: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return fail("Ya existe un registro con ese código", 409);
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
    limit: req.nextUrl.searchParams.get("limit") ?? 25,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) return fail("Parámetros inválidos", 400, query.error.flatten());

  const { page, limit, search } = query.data;
  const where: any = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { scientificName: { contains: search, mode: "insensitive" as const } },
          { commonName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    :
    {};

  if (authResult.session.user.organizationId) {
    where.organizationId = authResult.session.user.organizationId;
  }

  const [total, items] = await Promise.all([
    prisma.species.count({ where }),
    prisma.species.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: "desc" }],
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
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "forest-config", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = speciesCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  try {
    const created = await prisma.species.create({
      data: {
        organizationId: authResult.session.user.organizationId || null,
        code: parsed.data.code,
        scientificName: parsed.data.scientificName,
        commonName: parsed.data.commonName,
        genus: parsed.data.genus,
        family: parsed.data.family,
        taxonomicOrder: parsed.data.taxonomicOrder,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "Species",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear la especie vegetal");
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "forest-config", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = speciesUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  try {
    const updated = await prisma.species.update({
      where: { id: parsed.data.id },
      data: {
        code: parsed.data.code,
        scientificName: parsed.data.scientificName,
        commonName: parsed.data.commonName,
        genus: parsed.data.genus,
        family: parsed.data.family,
        taxonomicOrder: parsed.data.taxonomicOrder,
        isActive: parsed.data.isActive,
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "Species",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar la especie vegetal");
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN") ?? false;
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "forest-config", "DELETE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = deleteByIdSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const relatedCount = await prisma.vegetalMaterial.count({ where: { speciesId: parsed.data.id } });
  if (relatedCount > 0) {
    return fail("No se puede eliminar la especie porque tiene materiales vegetales relacionados", 409);
  }

  try {
    await prisma.species.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "Species",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar la especie vegetal");
  }
}
