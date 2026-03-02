import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";

function canManageOrganizations(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

function isSuperAdmin(roles: string[]) {
  return roles.includes("SUPER_ADMIN");
}

function isScopedAdmin(roles: string[]) {
  return roles.includes("ADMIN") && !isSuperAdmin(roles);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const organizationId = authResult.session.user.organizationId ?? null;
  if (!canManageOrganizations(roles)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "UPDATE");
    if (permissionError) return permissionError;
  }

  if (isScopedAdmin(roles) && organizationId !== id) {
    return fail("Un usuario ADMIN solo puede editar su propia organización", 403);
  }

  try {
    const restored = await prisma.organization.update({
      where: { id },
      data: { deletedAt: null },
      select: {
        id: true,
        name: true,
        settings: true,
        countryId: true,
        createdAt: true,
      },
    });

    return ok({
      id: restored.id,
      name: restored.name,
      rif: (restored.settings as { rif?: string } | null)?.rif ?? "",
      countryId: restored.countryId,
      createdAt: restored.createdAt,
    });
  } catch {
    return fail("No se pudo restaurar la organización", 500);
  }
}
