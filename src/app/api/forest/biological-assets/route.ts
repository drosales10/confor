import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createBiologicalAssetSchema,
  deleteBiologicalAssetSchema,
  getBiologicalAssetQuerySchema,
  updateBiologicalAssetSchema,
} from "@/validations/forest-biological-asset.schema";

async function safeAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
  try {
    await prisma.auditLog.create({ data });
  } catch {}
}

function mapCreateError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("Ya existe un registro con esa clave biológica", 409);
    }

    if (error.code === "P2003") {
      return fail("No se pudo completar el registro por una relación inválida", 400);
    }

    if (error.code === "P2011") {
      return fail("Falta un dato obligatorio para crear el registro", 400);
    }

    if (error.code === "P2021") {
      return fail("La tabla de activos biológicos no existe en la base de datos", 500);
    }

    if (error.code === "P2022") {
      return fail("La base de datos no tiene una columna esperada para activos biológicos", 500);
    }
  }

  return fail("No fue posible crear el registro", 500);
}

function decimalValue(value: number | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
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

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissions = authResult.session.user.permissions ?? [];
    const canRead = hasPermission(permissions, "forest-biological-asset", "READ");
    const canWrite = ["CREATE", "UPDATE", "DELETE"].some((action) =>
      hasPermission(permissions, "forest-biological-asset", action),
    );

    if (!canRead && !canWrite) {
      const permissionError = requirePermission(permissions, "forest-biological-asset", "READ");
      if (permissionError) return permissionError;
    }
  }

  const queryResult = getBiologicalAssetQuerySchema.safeParse({
    level4Id: req.nextUrl.searchParams.get("level4Id") ?? undefined,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "biologicalAssetKey",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "asc",
    page: req.nextUrl.searchParams.get("page") ?? 1,
    limit: req.nextUrl.searchParams.get("limit") ?? 25,
  });

  if (!queryResult.success) {
    return fail("Parámetros inválidos", 400, queryResult.error.flatten());
  }

  const { level4Id, search, sortBy, sortOrder, page, limit } = queryResult.data;
  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const where: Prisma.ForestBiologicalAssetLevel6WhereInput = {
    ...(level4Id ? { level4Id } : {}),
    ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    ...(search
      ? {
          OR: [
            { biologicalAssetKey: { contains: search, mode: "insensitive" } },
            { accountingKey: { contains: search, mode: "insensitive" } },
            { geneticMaterialName: { contains: search, mode: "insensitive" } },
            { inventoryCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.forestBiologicalAssetLevel6.count({ where }),
    prisma.forestBiologicalAssetLevel6.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ [sortBy]: sortOrder }],
      include: { level4: { select: { id: true, code: true, name: true } } },
    }),
  ]);

  return ok({ items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-biological-asset", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = createBiologicalAssetSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const parent = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: parsed.data.level4Id,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
  });
  if (!parent) {
    return fail("Nivel 4 no encontrado", 404);
  }

  try {
    const created = await prisma.forestBiologicalAssetLevel6.create({
      data: {
        level4Id: parsed.data.level4Id,
        biologicalAssetKey: parsed.data.biologicalAssetKey,
        accountingKey: parsed.data.accountingKey,
        establishmentDate: parsed.data.establishmentDate,
        plantingYear: parsed.data.plantingYear,
        geneticMaterialCode: parsed.data.geneticMaterialCode,
        geneticMaterialName: parsed.data.geneticMaterialName,
        assetType: parsed.data.assetType,
        managementSchemeCode: parsed.data.managementSchemeCode,
        managementSchemeName: parsed.data.managementSchemeName,
        inventoryCode: parsed.data.inventoryCode,
        inventoryType: parsed.data.inventoryType,
        inventoryDate: parsed.data.inventoryDate,
        inventoryAgeYears: parsed.data.inventoryAgeYears,
        level5UnitCount: parsed.data.level5UnitCount,
        spacingCode: parsed.data.spacingCode,
        spacingDescription: parsed.data.spacingDescription,
        spacingBetweenRowsM: decimalValue(parsed.data.spacingBetweenRowsM),
        spacingBetweenTreesM: decimalValue(parsed.data.spacingBetweenTreesM),
        treeDensityPerHa: decimalValue(parsed.data.treeDensityPerHa),
        survivalRate: decimalValue(parsed.data.survivalRate),
        dominantHeightM: decimalValue(parsed.data.dominantHeightM),
        meanHeightM: decimalValue(parsed.data.meanHeightM),
        quadraticDiameterM: decimalValue(parsed.data.quadraticDiameterM),
        basalAreaM2: decimalValue(parsed.data.basalAreaM2),
        unitVolumeM3NoBarkPerHa: decimalValue(parsed.data.unitVolumeM3NoBarkPerHa),
        unitVolumeM3WithBarkPerHa: decimalValue(parsed.data.unitVolumeM3WithBarkPerHa),
        totalVolumeM3NoBark: decimalValue(parsed.data.totalVolumeM3NoBark),
        totalVolumeM3WithBark: decimalValue(parsed.data.totalVolumeM3WithBark),
        adjustedVolumeM3NoBarkPerHa: decimalValue(parsed.data.adjustedVolumeM3NoBarkPerHa),
        adjustedVolumeM3WithBarkPerHa: decimalValue(parsed.data.adjustedVolumeM3WithBarkPerHa),
        imaClassCode: parsed.data.imaClassCode,
        imaClassName: parsed.data.imaClassName,
        actualCostUsd: decimalValue(parsed.data.actualCostUsd),
        isActive: parsed.data.isActive,
      },
      include: { level4: { select: { id: true, code: true, name: true } } },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "ForestBiologicalAssetLevel6",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapCreateError(error);
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-biological-asset", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = updateBiologicalAssetSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const current = await prisma.forestBiologicalAssetLevel6.findFirst({
    where: {
      id: parsed.data.id,
      ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    },
    select: { id: true },
  });

  if (!current) {
    return fail("Activo biológico no encontrado", 404);
  }

  const dataToUpdate: Prisma.ForestBiologicalAssetLevel6UpdateInput = {
    ...(parsed.data.biologicalAssetKey !== undefined ? { biologicalAssetKey: parsed.data.biologicalAssetKey } : {}),
    ...(parsed.data.accountingKey !== undefined ? { accountingKey: parsed.data.accountingKey } : {}),
    ...(parsed.data.establishmentDate !== undefined ? { establishmentDate: parsed.data.establishmentDate } : {}),
    ...(parsed.data.plantingYear !== undefined ? { plantingYear: parsed.data.plantingYear } : {}),
    ...(parsed.data.geneticMaterialCode !== undefined ? { geneticMaterialCode: parsed.data.geneticMaterialCode } : {}),
    ...(parsed.data.geneticMaterialName !== undefined ? { geneticMaterialName: parsed.data.geneticMaterialName } : {}),
    ...(parsed.data.assetType !== undefined ? { assetType: parsed.data.assetType } : {}),
    ...(parsed.data.managementSchemeCode !== undefined ? { managementSchemeCode: parsed.data.managementSchemeCode } : {}),
    ...(parsed.data.managementSchemeName !== undefined ? { managementSchemeName: parsed.data.managementSchemeName } : {}),
    ...(parsed.data.inventoryCode !== undefined ? { inventoryCode: parsed.data.inventoryCode } : {}),
    ...(parsed.data.inventoryType !== undefined ? { inventoryType: parsed.data.inventoryType } : {}),
    ...(parsed.data.inventoryDate !== undefined ? { inventoryDate: parsed.data.inventoryDate } : {}),
    ...(parsed.data.inventoryAgeYears !== undefined ? { inventoryAgeYears: parsed.data.inventoryAgeYears } : {}),
    ...(parsed.data.level5UnitCount !== undefined ? { level5UnitCount: parsed.data.level5UnitCount } : {}),
    ...(parsed.data.spacingCode !== undefined ? { spacingCode: parsed.data.spacingCode } : {}),
    ...(parsed.data.spacingDescription !== undefined ? { spacingDescription: parsed.data.spacingDescription } : {}),
    ...(parsed.data.spacingBetweenRowsM !== undefined ? { spacingBetweenRowsM: decimalValue(parsed.data.spacingBetweenRowsM) } : {}),
    ...(parsed.data.spacingBetweenTreesM !== undefined ? { spacingBetweenTreesM: decimalValue(parsed.data.spacingBetweenTreesM) } : {}),
    ...(parsed.data.treeDensityPerHa !== undefined ? { treeDensityPerHa: decimalValue(parsed.data.treeDensityPerHa) } : {}),
    ...(parsed.data.survivalRate !== undefined ? { survivalRate: decimalValue(parsed.data.survivalRate) } : {}),
    ...(parsed.data.dominantHeightM !== undefined ? { dominantHeightM: decimalValue(parsed.data.dominantHeightM) } : {}),
    ...(parsed.data.meanHeightM !== undefined ? { meanHeightM: decimalValue(parsed.data.meanHeightM) } : {}),
    ...(parsed.data.quadraticDiameterM !== undefined ? { quadraticDiameterM: decimalValue(parsed.data.quadraticDiameterM) } : {}),
    ...(parsed.data.basalAreaM2 !== undefined ? { basalAreaM2: decimalValue(parsed.data.basalAreaM2) } : {}),
    ...(parsed.data.unitVolumeM3NoBarkPerHa !== undefined
      ? { unitVolumeM3NoBarkPerHa: decimalValue(parsed.data.unitVolumeM3NoBarkPerHa) }
      : {}),
    ...(parsed.data.unitVolumeM3WithBarkPerHa !== undefined
      ? { unitVolumeM3WithBarkPerHa: decimalValue(parsed.data.unitVolumeM3WithBarkPerHa) }
      : {}),
    ...(parsed.data.totalVolumeM3NoBark !== undefined
      ? { totalVolumeM3NoBark: decimalValue(parsed.data.totalVolumeM3NoBark) }
      : {}),
    ...(parsed.data.totalVolumeM3WithBark !== undefined
      ? { totalVolumeM3WithBark: decimalValue(parsed.data.totalVolumeM3WithBark) }
      : {}),
    ...(parsed.data.adjustedVolumeM3NoBarkPerHa !== undefined
      ? { adjustedVolumeM3NoBarkPerHa: decimalValue(parsed.data.adjustedVolumeM3NoBarkPerHa) }
      : {}),
    ...(parsed.data.adjustedVolumeM3WithBarkPerHa !== undefined
      ? { adjustedVolumeM3WithBarkPerHa: decimalValue(parsed.data.adjustedVolumeM3WithBarkPerHa) }
      : {}),
    ...(parsed.data.imaClassCode !== undefined ? { imaClassCode: parsed.data.imaClassCode } : {}),
    ...(parsed.data.imaClassName !== undefined ? { imaClassName: parsed.data.imaClassName } : {}),
    ...(parsed.data.actualCostUsd !== undefined ? { actualCostUsd: decimalValue(parsed.data.actualCostUsd) } : {}),
    ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
  };

  const updated = await prisma.forestBiologicalAssetLevel6.update({
    where: { id: parsed.data.id },
    data: dataToUpdate,
    include: { level4: { select: { id: true, code: true, name: true } } },
  });

  await safeAuditLog({
    userId: authResult.session.user.id,
    action: "UPDATE",
    entityType: "ForestBiologicalAssetLevel6",
    entityId: updated.id,
    newValues: parsed.data,
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-biological-asset", "DELETE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = deleteBiologicalAssetSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const current = await prisma.forestBiologicalAssetLevel6.findFirst({
    where: {
      id: parsed.data.id,
      ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    },
    select: { id: true },
  });

  if (!current) {
    return fail("Activo biológico no encontrado", 404);
  }

  await prisma.forestBiologicalAssetLevel6.delete({ where: { id: parsed.data.id } });

  await safeAuditLog({
    userId: authResult.session.user.id,
    action: "DELETE",
    entityType: "ForestBiologicalAssetLevel6",
    entityId: parsed.data.id,
  });

  return ok({ message: "Activo biológico eliminado" });
}
