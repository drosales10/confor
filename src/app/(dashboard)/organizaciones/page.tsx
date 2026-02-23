import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRolesAndPermissions } from "@/lib/permissions";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { Button } from "@/components/ui/button";

async function getOrganizations() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    rif: (organization.settings as { rif?: string } | null)?.rif ?? "",
    createdAt: organization.createdAt,
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
  const canCreateOrganizations = ability.can("create", "organizations");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Organizaciones</h1>
        {canCreateOrganizations ? (
          <Button type="button">
            + Nueva Organización
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">RIF</th>
              <th className="px-3 py-2">Fecha de Creación</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr className="border-b" key={organization.id}>
                <td className="px-3 py-2">{organization.id}</td>
                <td className="px-3 py-2">{organization.name}</td>
                <td className="px-3 py-2">{organization.rif}</td>
                <td className="px-3 py-2">{new Date(organization.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {organizations.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>
                  Sin resultados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
