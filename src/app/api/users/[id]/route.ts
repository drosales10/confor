import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { updateUserSchema } from "@/validations/user.schema";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "users", "READ");
  if (permissionError) return permissionError;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { include: { role: true } }, profile: true },
  });

  if (!user) return fail("Usuario no encontrado", 404);
  return ok(user);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "users", "UPDATE");
  if (permissionError) return permissionError;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const user = await prisma.user.update({ where: { id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      newValues: parsed.data,
    },
  });

  return ok(user);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "users", "DELETE");
  if (permissionError) return permissionError;

  const { id } = await params;

  await prisma.user.update({
    where: { id },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      email: `deleted_${Date.now()}_${id}@invalid.local`,
    },
  });

  await prisma.session.updateMany({
    where: { userId: id, isActive: true },
    data: { isActive: false, revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "User",
      entityId: id,
    },
  });

  return ok({ message: "Usuario eliminado lógicamente" });
}
