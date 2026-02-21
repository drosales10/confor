import { NextRequest } from "next/server";
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

  const items = await prisma.forestPatrimonyNeighbor.findMany({
    where: { level2Id: level2IdResult.data },
    orderBy: [{ createdAt: "desc" }],
  });

  return ok({ items });
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

  const parent = await prisma.forestPatrimonyLevel2.findUnique({ where: { id: parsed.data.level2Id } });
  if (!parent) {
    return fail("Nivel 2 no encontrado", 404);
  }

  const created = await prisma.forestPatrimonyNeighbor.create({
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: created.id,
      newValues: parsed.data,
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
  const parsed = updateNeighborSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const updated = await prisma.forestPatrimonyNeighbor.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: updated.id,
      newValues: parsed.data,
    },
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
  const parsed = deleteNeighborSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  await prisma.forestPatrimonyNeighbor.delete({ where: { id: parsed.data.id } });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "ForestPatrimonyNeighbor",
      entityId: parsed.data.id,
    },
  });

  return ok({ message: "Vecino eliminado" });
}
