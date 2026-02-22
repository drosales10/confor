import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  GERENTE_CAMPO: "Gerente de Campo",
  CONTADOR: "Contador",
  USER: "Usuario",
  MANAGER: "Manager",
};

const ROLE_PERMISSIONS: Record<string, Array<{ module: string; actions: string[] }> | "ALL"> = {
  SUPER_ADMIN: "ALL",
  ADMIN: "ALL",
  GERENTE_CAMPO: [
    { module: "forest-patrimony", actions: ["READ", "CREATE", "UPDATE"] },
    { module: "forest-biological-asset", actions: ["READ"] },
    { module: "users", actions: ["READ"] },
  ],
  MANAGER: [
    { module: "forest-patrimony", actions: ["READ", "CREATE", "UPDATE"] },
    { module: "forest-biological-asset", actions: ["READ"] },
    { module: "users", actions: ["READ"] },
  ],
  CONTADOR: [{ module: "forest-patrimony", actions: ["READ"] }],
  USER: [{ module: "dashboard", actions: ["READ"] }],
};

export async function ensureRoleWithPermissions(roleSlug: string, organizationId: string) {
  const role = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: roleSlug,
      },
    },
    update: {
      name: ROLE_NAMES[roleSlug] ?? roleSlug,
    },
    create: {
      organizationId,
      slug: roleSlug,
      name: ROLE_NAMES[roleSlug] ?? roleSlug,
      isSystemRole: true,
      isActive: true,
    },
  });

  const permissionSpec = ROLE_PERMISSIONS[roleSlug] ?? ROLE_PERMISSIONS.USER;
  let permissions = [] as { id: string }[];

  if (permissionSpec === "ALL") {
    permissions = await prisma.permission.findMany({ select: { id: true } });
  } else {
    const moduleSlugs = permissionSpec.map((entry) => entry.module);
    const actions = Array.from(new Set(permissionSpec.flatMap((entry) => entry.actions))) as PermissionAction[];
    permissions = await prisma.permission.findMany({
      where: {
        module: { slug: { in: moduleSlugs } },
        action: { in: actions },
      },
      select: { id: true },
    });
  }

  if (permissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  return role;
}
