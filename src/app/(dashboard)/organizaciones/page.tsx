import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRolesAndPermissions } from "@/lib/permissions";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { OrganizationClient } from "./OrganizationClient";

async function getOrganizations() {
  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
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

  const organizations = await getOrganizations();

  return <OrganizationClient initialData={organizations} />;
}
