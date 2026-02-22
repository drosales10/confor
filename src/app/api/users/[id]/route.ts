import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { updateUserSchema } from "@/validations/user.schema";
import { ensureRoleWithPermissions } from "@/lib/role-provisioning";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "users", "READ");
    if (permissionError) return permissionError;
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { where: { isActive: true }, include: { role: true } }, profile: true },
  });

  if (!user) return fail("Usuario no encontrado", 404);
  return ok(user);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "users", "UPDATE");
    if (permissionError) return permissionError;
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 400, parsed.error.flatten());

  const current = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { where: { isActive: true } } },
  });
  if (!current) return fail("Usuario no encontrado", 404);

  const organizationId = parsed.data.organizationId ?? current.organizationId ?? undefined;
  let roleId: string | null = null;
  if (parsed.data.roleSlug) {
    if (!organizationId) {
      return fail("La organización es obligatoria para asignar rol", 400);
    }
    const role = await ensureRoleWithPermissions(parsed.data.roleSlug, organizationId);
    roleId = role.id;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (roleId) {
      await tx.userRole.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false },
      });
      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: id,
            roleId,
          },
        },
        update: { isActive: true },
        create: {
          userId: id,
          roleId,
          assignedBy: authResult.session.user.id,
          isActive: true,
        },
      });
    }

    const user = await tx.user.update({
      where: { id },
      data: {
        ...(parsed.data.firstName !== undefined ? { firstName: parsed.data.firstName } : {}),
        ...(parsed.data.lastName !== undefined ? { lastName: parsed.data.lastName } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(organizationId ? { organizationId } : {}),
      },
      include: { userRoles: { where: { isActive: true }, include: { role: true } }, organization: true },
    });

    await tx.auditLog.create({
      data: {
        userId: authResult.session.user.id,
        action: "UPDATE",
        entityType: "User",
        entityId: id,
        newValues: parsed.data,
      },
    });

    return user;
  });

  return ok(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "users", "DELETE");
    if (permissionError) return permissionError;
  }

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
