import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRolesAndPermissions } from "@/lib/permissions";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { OrganizationClient } from "./OrganizationClient";

function isSuperAdmin(roles: string[]) {
  return roles.includes("SUPER_ADMIN");
}

function isScopedAdmin(roles: string[]) {
  return roles.includes("ADMIN") && !isSuperAdmin(roles);
}

async function getOrganizations(roles: string[], organizationId?: string | null) {
  const organizations = await prisma.organization.findMany({
    where: {
      deletedAt: null,
      ...(isScopedAdmin(roles) ? { id: organizationId ?? "" } : {}),
    },
    include: { country: true },
    orderBy: { createdAt: "desc" },
  });

  return (organizations as any[]).map((organization) => ({
    id: organization.id,
    name: organization.name,
    rif: (organization.settings as { rif?: string } | null)?.rif ?? "",
    countryId: organization.countryId,
    country: organization.country,
    createdAt: organization.createdAt.toISOString(),
  }));
}

export default async function OrganizacionesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const livePermissionInfo = await getUserRolesAndPermissions(session.user.id);
  const ability = buildAbilityFromPermissions(livePermissionInfo?.permissions ?? []);

  if (!ability.can("read", "organizations")) {
    redirect("/unauthorized");
  }

  const organizations = await getOrganizations(session.user.roles ?? [], session.user.organizationId ?? null);

  return <OrganizationClient initialData={organizations} />;
}
