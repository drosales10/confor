import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  cityCreateSchema,
  cityUpdateSchema,
  deleteByIdSchema,
} from "@/validations/forest-config.schema";
import { z } from "zod";

const sortKeys = [
  "municipalityName",
  "stateName",
  "countryName",
  "code",
  "name",
  "isActive",
  "createdAt",
  "updatedAt",
] as const;
type SortKey = (typeof sortKeys)[number];

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
    if (error.code === "P2002") return fail("Ya existe un registro con ese código en el municipio", 409);
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

  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(25),
    search: z.string().trim().optional(),
    sortBy: z.enum(sortKeys).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  });

  const query = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? 1,
    limit: req.nextUrl.searchParams.get("limit") ?? 25,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "name",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "asc",
  });

  if (!query.success) return fail("Parámetros inválidos", 400, query.error.flatten());

  const { page, limit, search, sortBy, sortOrder } = query.data;
  const where = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
          { municipality: { name: { contains: search, mode: "insensitive" as const } } },
          { municipality: { code: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const scalarOrderBy: Record<Exclude<SortKey, "municipalityName" | "stateName" | "countryName">, "asc" | "desc"> = {
    code: sortOrder,
    name: sortOrder,
    isActive: sortOrder,
    createdAt: sortOrder,
    updatedAt: sortOrder,
  };

  const orderBy =
    sortBy === "municipalityName"
      ? [{ municipality: { name: sortOrder } }]
      : sortBy === "stateName"
        ? [{ municipality: { state: { name: sortOrder } } }]
        : sortBy === "countryName"
          ? [{ municipality: { state: { country: { name: sortOrder } } } }]
          : [{ [sortBy]: scalarOrderBy[sortBy] }];

  const [total, items] = await Promise.all([
    prisma.city.count({ where }),
    prisma.city.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        municipality: {
          select: {
            id: true,
            code: true,
            name: true,
            state: {
              select: {
                id: true,
                code: true,
                name: true,
                country: { select: { id: true, code: true, name: true } },
              },
            },
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
  const parsed = cityCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const municipality = await prisma.municipalityDistrict.findUnique({ where: { id: parsed.data.municipalityId } });
  if (!municipality) return fail("Municipio/distrito no encontrado", 404);

  try {
    const created = await prisma.city.create({
      data: {
        municipalityId: parsed.data.municipalityId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        municipality: {
          select: {
            id: true,
            code: true,
            name: true,
            state: {
              select: {
                id: true,
                code: true,
                name: true,
                country: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "City",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear la ciudad");
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
  const parsed = cityUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  if (parsed.data.municipalityId) {
    const municipality = await prisma.municipalityDistrict.findUnique({ where: { id: parsed.data.municipalityId } });
    if (!municipality) return fail("Municipio/distrito no encontrado", 404);
  }

  try {
    const updated = await prisma.city.update({
      where: { id: parsed.data.id },
      data: {
        municipalityId: parsed.data.municipalityId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
      include: {
        municipality: {
          select: {
            id: true,
            code: true,
            name: true,
            state: {
              select: {
                id: true,
                code: true,
                name: true,
                country: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "City",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar la ciudad");
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

  const relatedCount = await prisma.communityTerritory.count({ where: { cityId: parsed.data.id } });
  if (relatedCount > 0) {
    return fail("No se puede eliminar la ciudad porque tiene desarrollos locales relacionados", 409);
  }

  try {
    await prisma.city.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "City",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar la ciudad");
  }
}
