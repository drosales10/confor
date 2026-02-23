import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

function canManageRoles(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

function normalizeRoleSlug(slug: string) {
  return slug.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "_");
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

  const rolesFromSession = authResult.session.user.roles ?? [];
  if (!canManageRoles(rolesFromSession)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "READ");
    if (permissionError) return permissionError;
  }

  const requestedOrganizationId = req.nextUrl.searchParams.get("organizationId");

  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (
    requestedOrganizationId &&
    currentOrganizationId &&
    requestedOrganizationId !== currentOrganizationId &&
    !canManageRoles(rolesFromSession)
  ) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "READ");
    if (permissionError) return permissionError;
  }

  const roleScope = requestedOrganizationId
    ? { OR: [{ organizationId: requestedOrganizationId }, { organizationId: null }] }
    : currentOrganizationId
      ? { OR: [{ organizationId: currentOrganizationId }, { organizationId: null }] }
      : { organizationId: null as string | null };

  const [roles, modules] = await Promise.all([
    prisma.role.findMany({
      where: { isActive: true, ...roleScope },
      orderBy: [{ isSystemRole: "desc" }, { name: "asc" }],
      include: {
        organization: {
          select: {
            name: true,
          },
        },
        rolePermissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    }),
    prisma.module.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        permissions: {
          orderBy: { action: "asc" },
        },
      },
    }),
  ]);

  const dedupedRolesBySlug = new Map<string, (typeof roles)[number]>();
  for (const role of roles) {
    const existing = dedupedRolesBySlug.get(role.slug);
    if (!existing) {
      dedupedRolesBySlug.set(role.slug, role);
      continue;
    }

    const existingMatchesOrg = existing.organizationId === currentOrganizationId;
    const candidateMatchesOrg = role.organizationId === currentOrganizationId;
    if (!existingMatchesOrg && candidateMatchesOrg) {
      dedupedRolesBySlug.set(role.slug, role);
    }
  }

  const dedupedRoles = Array.from(dedupedRolesBySlug.values()).sort((a, b) => a.name.localeCompare(b.name));

  return ok({
    roles: dedupedRoles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      organizationId: role.organizationId,
      organizationName: role.organization?.name ?? null,
      isSystemRole: role.isSystemRole,
      permissions: role.rolePermissions.map((item) => ({
        permissionId: item.permissionId,
        moduleSlug: item.permission.module.slug,
        action: item.permission.action,
      })),
    })),
    modules: modules.map((moduleItem) => ({
      id: moduleItem.id,
      name: moduleItem.name,
      slug: moduleItem.slug,
      actions: moduleItem.permissions.map((permission) => ({
        permissionId: permission.id,
        action: permission.action,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rolesFromSession = authResult.session.user.roles ?? [];
  if (!canManageRoles(rolesFromSession)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "CREATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? normalizeRoleSlug(body.slug) : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;

  if (!name || !slug) {
    return fail("name y slug son obligatorios", 400);
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const existing = await prisma.role.findFirst({
    where: {
      slug,
      organizationId,
      isActive: true,
    },
    select: { id: true },
  });

  if (existing) {
    return fail("Ya existe un rol con ese slug", 409);
  }

  const role = await prisma.role.create({
    data: {
      name,
      slug,
      description,
      organizationId,
      isSystemRole: false,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      newValues: { name: role.name, slug: role.slug },
    },
  });

  return ok(role, 201);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rolesFromSession = authResult.session.user.roles ?? [];
  if (!canManageRoles(rolesFromSession)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "users", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json().catch(() => null);
  const roleId = typeof body?.roleId === "string" ? body.roleId : "";
  const permissionIds: string[] = Array.isArray(body?.permissionIds)
    ? body.permissionIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!roleId) {
    return fail("roleId es obligatorio", 400);
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    return fail("Rol no encontrado", 404);
  }

  const uniquePermissionIds = Array.from(new Set(permissionIds));
  const validPermissions = uniquePermissionIds.length
    ? await prisma.permission.findMany({
        where: { id: { in: uniquePermissionIds } },
        select: { id: true },
      })
    : [];

  const validPermissionIds = new Set(validPermissions.map((item) => item.id));
  const cleanedPermissionIds = uniquePermissionIds.filter((permissionId) => validPermissionIds.has(permissionId));

  await prisma.$transaction(async (tx) => {
    if (cleanedPermissionIds.length === 0) {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      return;
    }

    await tx.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { notIn: cleanedPermissionIds },
      },
    });

    await tx.rolePermission.createMany({
      data: cleanedPermissionIds.map((permissionId) => ({
        roleId,
        permissionId,
        grantedBy: authResult.session.user.id,
      })),
      skipDuplicates: true,
    });
  });

  return ok({ roleId, permissionIds: cleanedPermissionIds });
}
