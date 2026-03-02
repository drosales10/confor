import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import {
  deleteByIdSchema,
  vegetalMaterialCreateSchema,
  vegetalMaterialUpdateSchema,
} from "@/validations/forest-config.schema";
import { z } from "zod";

const sortKeys = ["code", "name", "speciesName", "provenanceName", "materialType", "isActive", "createdAt", "updatedAt"] as const;
type SortKey = (typeof sortKeys)[number];

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

  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().optional(),
    sortBy: z.enum(sortKeys).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });

  const query = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? 1,
    limit: req.nextUrl.searchParams.get("limit") ?? 25,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "createdAt",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) return fail("Parámetros inválidos", 400, query.error.flatten());

  const { page, limit, search, sortBy, sortOrder } = query.data;
  const where: any = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
          { species: { scientificName: { contains: search, mode: "insensitive" as const } } },
          { provenance: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    :
    {};

  if (authResult.session.user.organizationId) {
    where.organizationId = authResult.session.user.organizationId;
  }

  const scalarOrderBy: Record<Exclude<SortKey, "speciesName" | "provenanceName">, "asc" | "desc"> = {
    code: sortOrder,
    name: sortOrder,
    materialType: sortOrder,
    isActive: sortOrder,
    createdAt: sortOrder,
    updatedAt: sortOrder,
  };

  const orderBy =
    sortBy === "speciesName"
      ? [{ species: { scientificName: sortOrder } }]
      : sortBy === "provenanceName"
        ? [{ provenance: { name: sortOrder } }]
        : [{ [sortBy]: scalarOrderBy[sortBy] }];

  const [total, items] = await Promise.all([
    prisma.vegetalMaterial.count({ where }),
    prisma.vegetalMaterial.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        species: { select: { id: true, code: true, scientificName: true } },
        provenance: {
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
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "forest-config", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = vegetalMaterialCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId } });
  if (!species) return fail("Especie no encontrada", 404);

  if (parsed.data.provenanceId) {
    const provenance = await prisma.provenance.findUnique({ where: { id: parsed.data.provenanceId } });
    if (!provenance) return fail("Procedencia no encontrada", 404);
  }

  try {
    const created = await prisma.vegetalMaterial.create({
      data: {
        organizationId: authResult.session.user.organizationId || null,
        code: parsed.data.code,
        name: parsed.data.name,
        speciesId: parsed.data.speciesId,
        materialType: parsed.data.materialType,
        plantType: parsed.data.plantType,
        plantOrigin: parsed.data.plantOrigin,
        provenanceId: parsed.data.provenanceId ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        species: { select: { id: true, code: true, scientificName: true } },
        provenance: {
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
      entityType: "VegetalMaterial",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapPrismaError(error, "No fue posible crear el material vegetal");
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
  const parsed = vegetalMaterialUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  if (parsed.data.speciesId) {
    const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId } });
    if (!species) return fail("Especie no encontrada", 404);
  }

  if (parsed.data.provenanceId) {
    const provenance = await prisma.provenance.findUnique({ where: { id: parsed.data.provenanceId } });
    if (!provenance) return fail("Procedencia no encontrada", 404);
  }

  try {
    const updated = await prisma.vegetalMaterial.update({
      where: { id: parsed.data.id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        speciesId: parsed.data.speciesId,
        materialType: parsed.data.materialType,
        plantType: parsed.data.plantType,
        plantOrigin: parsed.data.plantOrigin,
        provenanceId: parsed.data.provenanceId,
        isActive: parsed.data.isActive,
      },
      include: {
        species: { select: { id: true, code: true, scientificName: true } },
        provenance: {
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
      entityType: "VegetalMaterial",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapPrismaError(error, "No fue posible actualizar el material vegetal");
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
    await prisma.vegetalMaterial.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "VegetalMaterial",
      entityId: parsed.data.id,
    });

    return ok({ id: parsed.data.id });
  } catch (error) {
    return mapPrismaError(error, "No fue posible eliminar el material vegetal");
  }
}
