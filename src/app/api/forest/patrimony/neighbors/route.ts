import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { deleteNeighborSchema, updateNeighborSchema } from "@/validations/forest-patrimony.schema";
import { uuidSchema } from "@/validations/common.schema";
import { z } from "zod";

const createNeighborSchema = z.object({
  level2Id: uuidSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(255),
  type: z.string().min(2).max(80),
});

async function safeAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
  try {
    await prisma.auditLog.create({ data });
  } catch {}
}

function mapNeighborError(error: unknown, fallbackMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("Ya existe un vecino con ese codigo", 409);
    }

    if (error.code === "P2025") {
      return fail("Registro no encontrado", 404);
    }
  }

  return fail(fallbackMessage, 500);
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
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "READ");
    if (permissionError) return permissionError;
  }

  const level2IdResult = uuidSchema.safeParse(req.nextUrl.searchParams.get("level2Id"));
  if (!level2IdResult.success) {
    return fail("Parámetro level2Id inválido", 400, level2IdResult.error.flatten());
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  try {
    const items = await prisma.forestPatrimonyNeighbor.findMany({
      where: {
        level2Id: level2IdResult.data,
        ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return ok({ items });
  } catch (error) {
    return mapNeighborError(error, "No fue posible cargar vecinos");
  }
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
  const parsed = createNeighborSchema.safeParse(body);
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

  const parent = await prisma.forestPatrimonyLevel2.findFirst({
    where: {
      id: parsed.data.level2Id,
      ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
    },
  });
  if (!parent) {
    return fail("Nivel 2 no encontrado", 404);
  }

  try {
    const created = await prisma.forestPatrimonyNeighbor.create({
      data: parsed.data,
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: created.id,
      newValues: parsed.data,
    });

    return ok(created, 201);
  } catch (error) {
    return mapNeighborError(error, "No fue posible crear vecino");
  }
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
  const parsed = updateNeighborSchema.safeParse(body);
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

  const current = await prisma.forestPatrimonyNeighbor.findFirst({
    where: {
      id: parsed.data.id,
      ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
    },
    select: { id: true },
  });
  if (!current) {
    return fail("Registro no encontrado", 404);
  }

  try {
    const updated = await prisma.forestPatrimonyNeighbor.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      },
    });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: updated.id,
      newValues: parsed.data,
    });

    return ok(updated);
  } catch (error) {
    return mapNeighborError(error, "No fue posible actualizar el vecino");
  }
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
  const parsed = deleteNeighborSchema.safeParse(body);
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

  const current = await prisma.forestPatrimonyNeighbor.findFirst({
    where: {
      id: parsed.data.id,
      ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
    },
    select: { id: true },
  });
  if (!current) {
    return fail("Registro no encontrado", 404);
  }

  try {
    await prisma.forestPatrimonyNeighbor.delete({ where: { id: parsed.data.id } });

    await safeAuditLog({
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: parsed.data.id,
    });

    return ok({ message: "Vecino eliminado" });
  } catch (error) {
    return mapNeighborError(error, "No fue posible eliminar el vecino");
  }
}
