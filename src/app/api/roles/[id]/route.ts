import { NextRequest } from "next/server";
import { fail, ok, requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

function canManageRoles(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

function normalizeRoleSlug(slug: string) {
  return slug.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "_");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rolesFromSession = authResult.session.user.roles ?? [];
  if (!canManageRoles(rolesFromSession)) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role || !role.isActive) {
    return fail("Rol no encontrado", 404);
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? normalizeRoleSlug(body.slug) : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;

  if (!name || !slug) {
    return fail("name y slug son obligatorios", 400);
  }

  if (role.isSystemRole && slug !== role.slug) {
    return fail("No puedes cambiar el slug de un rol del sistema", 400);
  }

  const duplicated = await prisma.role.findFirst({
    where: {
      id: { not: id },
      organizationId: role.organizationId,
      slug,
      isActive: true,
    },
    select: { id: true },
  });

  if (duplicated) {
    return fail("Ya existe un rol con ese slug", 409);
  }

  const updated = await prisma.role.update({
    where: { id },
    data: {
      name,
      slug: role.isSystemRole ? role.slug : slug,
      description,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "Role",
      entityId: id,
      newValues: { name: updated.name, slug: updated.slug },
    },
  });

  return ok(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rolesFromSession = authResult.session.user.roles ?? [];
  if (!canManageRoles(rolesFromSession)) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role || !role.isActive) {
    return fail("Rol no encontrado", 404);
  }

  if (role.isSystemRole) {
    return fail("No puedes eliminar un rol del sistema", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.userRole.updateMany({
      where: { roleId: id, isActive: true },
      data: { isActive: false },
    });

    await tx.role.update({
      where: { id },
      data: { isActive: false },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "DELETE",
      entityType: "Role",
      entityId: id,
    },
  });

  return ok({ id, deleted: true });
}
