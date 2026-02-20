import { prisma } from "@/lib/prisma";

export async function getUserRolesAndPermissions(userId: string) {
  const roleAssignments = await prisma.userRole.findMany({
    where: { userId, isActive: true },
    include: {
      role: {
        include: {
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
      },
    },
  });

  const roles = roleAssignments.map((assignment) => assignment.role.slug);
  const permissions = roleAssignments.flatMap((assignment) =>
    assignment.role.rolePermissions.map(
      (rolePermission) => `${rolePermission.permission.module.slug}:${rolePermission.permission.action}`,
    ),
  );

  return {
    roles,
    permissions: Array.from(new Set(permissions)),
  };
}

export function hasPermission(permissions: string[], moduleSlug: string, action: string) {
  return permissions.includes(`${moduleSlug}:${action}`) || permissions.includes(`${moduleSlug}:ADMIN`);
}
