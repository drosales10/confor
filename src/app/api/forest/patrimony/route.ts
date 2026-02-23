import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculatePlotAreaM2 } from "@/lib/forest-area";
import {
  createPatrimonySchema,
  deletePatrimonySchema,
  getPatrimonyQuerySchema,
  updatePatrimonySchema,
} from "@/validations/forest-patrimony.schema";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";

async function safeAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
  try {
    await prisma.auditLog.create({ data });
  } catch {}
}

function mapCreateError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("Ya existe un registro con ese código", 409);
    }

    if (error.code === "P2003") {
      return fail("No se pudo completar el registro por una relación inválida", 400);
    }
  }

  return fail("No fue posible crear el registro", 500);
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
    const canReadPatrimony = hasPermission(permissions, "forest-patrimony", "READ");
    const canReadBiologicalAssets = hasPermission(permissions, "forest-biological-asset", "READ");
    const canWriteBiologicalAssets = ["CREATE", "UPDATE", "DELETE"].some((action) =>
      hasPermission(permissions, "forest-biological-asset", action),
    );

    if (!canReadPatrimony && !canReadBiologicalAssets && !canWriteBiologicalAssets) {
      const permissionError = requirePermission(permissions, "forest-patrimony", "READ");
      if (permissionError) return permissionError;
    }
  }

  const queryResult = getPatrimonyQuerySchema.safeParse({
    level: req.nextUrl.searchParams.get("level"),
    page: req.nextUrl.searchParams.get("page") ?? 1,
    limit: req.nextUrl.searchParams.get("limit") ?? 25,
    parentId: req.nextUrl.searchParams.get("parentId") ?? undefined,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
  });

  if (!queryResult.success) {
    return fail("Parámetros inválidos", 400, queryResult.error.flatten());
  }

  const { level, page, limit, parentId, search } = queryResult.data;
  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (level === "2") {
    const where: Prisma.ForestPatrimonyLevel2WhereInput = {
      ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.forestPatrimonyLevel2.count({ where }),
      prisma.forestPatrimonyLevel2.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
      }),
    ]);

    return ok({ items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  }

  if (level === "3") {
    const where: Prisma.ForestPatrimonyLevel3WhereInput = {
      ...(parentId ? { level2Id: parentId } : {}),
      ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.forestPatrimonyLevel3.count({ where }),
      prisma.forestPatrimonyLevel3.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: { level2: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    return ok({ items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  }

  if (level === "4") {
    const where: Prisma.ForestPatrimonyLevel4WhereInput = {
      ...(parentId ? { level3Id: parentId } : {}),
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.forestPatrimonyLevel4.count({ where }),
      prisma.forestPatrimonyLevel4.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          level3: { select: { id: true, code: true, name: true } },
          _count: { select: { level6Assets: true } },
        },
      }),
    ]);

    return ok({ items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  }

  const where: Prisma.ForestPatrimonyLevel5WhereInput = {
    ...(parentId ? { level4Id: parentId } : {}),
    ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.forestPatrimonyLevel5.count({ where }),
    prisma.forestPatrimonyLevel5.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      include: { level4: { select: { id: true, code: true, name: true } } },
    }),
  ]);

  return ok({ items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = createPatrimonySchema.safeParse(body);
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

  if (parsed.data.level === "2") {
    try {
      const created = await prisma.forestPatrimonyLevel2.create({
        data: {
          ...parsed.data.data,
          ...(!isSuperAdmin ? { organizationId: organizationId ?? undefined } : {}),
        },
      });

      await safeAuditLog({
        userId: authResult.session.user.id,
        action: "CREATE",
        entityType: "ForestPatrimonyLevel2",
        entityId: created.id,
        newValues: parsed.data.data,
      });

      return ok(created, 201);
    } catch (error) {
      return mapCreateError(error);
    }
  }

  if (parsed.data.level === "3") {
    const parent = await prisma.forestPatrimonyLevel2.findFirst({
      where: {
        id: parsed.data.data.level2Id,
        ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      },
    });
    if (!parent) {
      return fail("Nivel 2 no encontrado", 404);
    }

    const created = await prisma.forestPatrimonyLevel3.create({
      data: parsed.data.data,
      include: { level2: { select: { id: true, code: true, name: true } } },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "ForestPatrimonyLevel3",
      entityId: created.id,
      newValues: parsed.data.data,
    });

    return ok(created, 201);
  }

  if (parsed.data.level === "4") {
    const parent = await prisma.forestPatrimonyLevel3.findFirst({
      where: {
        id: parsed.data.data.level3Id,
        ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      },
    });
    if (!parent) {
      return fail("Nivel 3 no encontrado", 404);
    }

    const created = await prisma.forestPatrimonyLevel4.create({
      data: parsed.data.data,
      include: { level3: { select: { id: true, code: true, name: true } } },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "ForestPatrimonyLevel4",
      entityId: created.id,
      newValues: parsed.data.data,
    });

    return ok(created, 201);
  }

  const areaM2 = calculatePlotAreaM2(parsed.data.data);
  if (!areaM2) {
    return fail("No se pudo calcular el área del nivel 5 con las dimensiones proporcionadas", 400);
  }

  const parent = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: parsed.data.data.level4Id,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
  });
  if (!parent) {
    return fail("Nivel 4 no encontrado", 404);
  }

  const created = await prisma.forestPatrimonyLevel5.create({
    data: {
      ...parsed.data.data,
      areaM2,
    },
    include: { level4: { select: { id: true, code: true, name: true } } },
  });

  await safeAuditLog({
    userId: authResult.session.user.id,
    action: "CREATE",
    entityType: "ForestPatrimonyLevel5",
    entityId: created.id,
    newValues: {
      ...parsed.data.data,
      areaM2,
    },
  });

  return ok(created, 201);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = updatePatrimonySchema.safeParse(body);
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

  if (parsed.data.level === "2") {
    const current = await prisma.forestPatrimonyLevel2.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 2 no encontrado", 404);
    }

    const updated = await prisma.forestPatrimonyLevel2.update({
      where: { id: parsed.data.id },
      data: parsed.data.data,
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "ForestPatrimonyLevel2",
      entityId: updated.id,
      newValues: parsed.data.data,
    });

    return ok(updated);
  }

  if (parsed.data.level === "3") {
    const current = await prisma.forestPatrimonyLevel3.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 3 no encontrado", 404);
    }

    const updated = await prisma.forestPatrimonyLevel3.update({
      where: { id: parsed.data.id },
      data: parsed.data.data,
      include: { level2: { select: { id: true, code: true, name: true } } },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "ForestPatrimonyLevel3",
      entityId: updated.id,
      newValues: parsed.data.data,
    });

    return ok(updated);
  }

  if (parsed.data.level === "4") {
    const current = await prisma.forestPatrimonyLevel4.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 4 no encontrado", 404);
    }

    const updated = await prisma.forestPatrimonyLevel4.update({
      where: { id: parsed.data.id },
      data: parsed.data.data,
      include: { level3: { select: { id: true, code: true, name: true } } },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "ForestPatrimonyLevel4",
      entityId: updated.id,
      newValues: parsed.data.data,
    });

    return ok(updated);
  }

  const dataToUpdate: typeof parsed.data.data & { areaM2?: number } = { ...parsed.data.data };
  if (
    parsed.data.data.shapeType ||
    parsed.data.data.dimension1M !== undefined ||
    parsed.data.data.dimension2M !== undefined ||
    parsed.data.data.dimension3M !== undefined ||
    parsed.data.data.dimension4M !== undefined
  ) {
    const current = await prisma.forestPatrimonyLevel5.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
      },
    });
    if (!current) {
      return fail("Nivel 5 no encontrado", 404);
    }

    const areaM2 = calculatePlotAreaM2({
      shapeType: parsed.data.data.shapeType ?? current.shapeType,
      dimension1M:
        parsed.data.data.dimension1M ??
        (current.dimension1M === null || current.dimension1M === undefined ? null : Number(current.dimension1M)),
      dimension2M:
        parsed.data.data.dimension2M ??
        (current.dimension2M === null || current.dimension2M === undefined ? null : Number(current.dimension2M)),
      dimension3M:
        parsed.data.data.dimension3M ??
        (current.dimension3M === null || current.dimension3M === undefined ? null : Number(current.dimension3M)),
      dimension4M:
        parsed.data.data.dimension4M ??
        (current.dimension4M === null || current.dimension4M === undefined ? null : Number(current.dimension4M)),
    });

    if (!areaM2) {
      return fail("No se pudo calcular el área del nivel 5 con las dimensiones proporcionadas", 400);
    }

    dataToUpdate.areaM2 = areaM2;
  }

  if (parsed.data.level === "5") {
    const current = await prisma.forestPatrimonyLevel5.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 5 no encontrado", 404);
    }
  }

  const updated = await prisma.forestPatrimonyLevel5.update({
    where: { id: parsed.data.id },
    data: dataToUpdate,
    include: { level4: { select: { id: true, code: true, name: true } } },
  });

  await safeAuditLog({
    userId: authResult.session.user.id,
    action: "UPDATE",
    entityType: "ForestPatrimonyLevel5",
    entityId: updated.id,
    newValues: dataToUpdate,
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "DELETE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = deletePatrimonySchema.safeParse(body);
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

  if (parsed.data.level === "2") {
    const current = await prisma.forestPatrimonyLevel2.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 2 no encontrado", 404);
    }

    const childrenCount = await prisma.forestPatrimonyLevel3.count({ where: { level2Id: parsed.data.id } });
    if (childrenCount > 0) {
      return fail("No se puede eliminar el nivel 2 porque tiene niveles 3 relacionados", 409);
    }

    await prisma.forestPatrimonyLevel2.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "ForestPatrimonyLevel2",
      entityId: parsed.data.id,
    });

    return ok({ message: "Nivel 2 eliminado" });
  }

  if (parsed.data.level === "3") {
    const current = await prisma.forestPatrimonyLevel3.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 3 no encontrado", 404);
    }

    const childrenCount = await prisma.forestPatrimonyLevel4.count({ where: { level3Id: parsed.data.id } });
    if (childrenCount > 0) {
      return fail("No se puede eliminar el nivel 3 porque tiene niveles 4 relacionados", 409);
    }

    await prisma.forestPatrimonyLevel3.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "ForestPatrimonyLevel3",
      entityId: parsed.data.id,
    });

    return ok({ message: "Nivel 3 eliminado" });
  }

  if (parsed.data.level === "4") {
    const current = await prisma.forestPatrimonyLevel4.findFirst({
      where: {
        id: parsed.data.id,
        ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
      },
      select: { id: true },
    });
    if (!current) {
      return fail("Nivel 4 no encontrado", 404);
    }

    const childrenCount = await prisma.forestPatrimonyLevel5.count({ where: { level4Id: parsed.data.id } });
    if (childrenCount > 0) {
      return fail("No se puede eliminar el nivel 4 porque tiene niveles 5 relacionados", 409);
    }

    await prisma.forestPatrimonyLevel4.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "ForestPatrimonyLevel4",
      entityId: parsed.data.id,
    });

    return ok({ message: "Nivel 4 eliminado" });
  }

  const current = await prisma.forestPatrimonyLevel5.findFirst({
    where: {
      id: parsed.data.id,
      ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    },
    select: { id: true },
  });
  if (!current) {
    return fail("Nivel 5 no encontrado", 404);
  }

  await prisma.forestPatrimonyLevel5.delete({ where: { id: parsed.data.id } });

  await safeAuditLog({
    userId: authResult.session.user.id,
    action: "DELETE",
    entityType: "ForestPatrimonyLevel5",
    entityId: parsed.data.id,
  });

  return ok({ message: "Nivel 5 eliminado" });
}
