import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  deleteByIdSchema,
  forestConfigQuerySchema,
  level4AdministrativeCostCreateSchema,
  level4AdministrativeCostUpdateSchema,
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
    if (error.code === "P2002") return fail("Ya existe un registro con ese código en la unidad administrativa", 409);
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
  const where = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { rotationPhase: { contains: search, mode: "insensitive" as const } },
          { level4: { name: { contains: search, mode: "insensitive" as const } } },
          { level4: { code: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, items] = await Promise.all([
    prisma.level4AdministrativeCost.count({ where }),
    prisma.level4AdministrativeCost.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      include: {
        level4: { select: { id: true, code: true, name: true } },
        accountingDocument: { select: { id: true, code: true, documentNumber: true } },
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
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "forest-config", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = level4AdministrativeCostCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const level4 = await prisma.forestPatrimonyLevel4.findUnique({ where: { id: parsed.data.level4Id } });
  if (!level4) return fail("Unidad administrativa nivel 4 no encontrada", 404);

  if (parsed.data.accountingDocumentId) {
    const document = await prisma.accountingDocument.findUnique({ where: { id: parsed.data.accountingDocumentId } });
    if (!document) return fail("Documento contable no encontrado", 404);
  }

  try {
    const created = await prisma.level4AdministrativeCost.create({
      data: {
        level4Id: parsed.data.level4Id,
        code: parsed.data.code,
        plantationAreaHa: parsed.data.plantationAreaHa,
        rotationPhase: parsed.data.rotationPhase ?? null,
        accountingDocumentId: parsed.data.accountingDocumentId ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        level4: { select: { id: true, code: true, name: true } },
        accountingDocument: { select: { id: true, code: true, documentNumber: true } },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "Level4AdministrativeCost",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear el costo nivel 4");
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
  const parsed = level4AdministrativeCostUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  if (parsed.data.level4Id) {
    const level4 = await prisma.forestPatrimonyLevel4.findUnique({ where: { id: parsed.data.level4Id } });
    if (!level4) return fail("Unidad administrativa nivel 4 no encontrada", 404);
  }

  if (parsed.data.accountingDocumentId) {
    const document = await prisma.accountingDocument.findUnique({ where: { id: parsed.data.accountingDocumentId } });
    if (!document) return fail("Documento contable no encontrado", 404);
  }

  try {
    const updated = await prisma.level4AdministrativeCost.update({
      where: { id: parsed.data.id },
      data: {
        level4Id: parsed.data.level4Id,
        code: parsed.data.code,
        plantationAreaHa: parsed.data.plantationAreaHa,
        rotationPhase: parsed.data.rotationPhase ?? undefined,
        accountingDocumentId: parsed.data.accountingDocumentId ?? undefined,
        isActive: parsed.data.isActive,
      },
      include: {
        level4: { select: { id: true, code: true, name: true } },
        accountingDocument: { select: { id: true, code: true, documentNumber: true } },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "Level4AdministrativeCost",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar el costo nivel 4");
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

  try {
    await prisma.level4AdministrativeCost.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "Level4AdministrativeCost",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar el costo nivel 4");
  }
}
