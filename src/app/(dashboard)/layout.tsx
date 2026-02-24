import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { getRolePermissions, normalizeRole } from "@/lib/rbac";
import StatusBar from "@/components/StatusBar";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { prisma } from "@/lib/prisma";
import { getUserRolesAndPermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardNav } from "@/components/DashboardNav";

const nav = [
  { href: "/dashboard", label: "Inicio", module: "dashboard" },
  { href: "/organizaciones", label: "Organizaciones", module: "organizations", onlyAdmin: true },
  { href: "/users", label: "Usuarios", module: "users", adminOrGerente: true },
  { href: "/roles", label: "Roles", module: "users", onlyAdmin: true },
  { href: "/patrimonio-forestal", label: "Patrimonio forestal", module: "forest-patrimony" },
  { href: "/activo-biologico", label: "Activo biológico", module: "forest-biological-asset" },
  { href: "/configuracion-forestal", label: "Configuración forestal", module: "forest-config" },
  { href: "/configuracion-general", label: "Configuración general", module: "general-config" },
  { href: "/profile", label: "Perfil", module: "profile" },
  { href: "/analytics", label: "Analítica", module: "analytics" },
  { href: "/settings", label: "Configuración", module: "settings" },
  { href: "/audit", label: "Auditoría", module: "audit" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cookieStore = await cookies();
  const roleFromCookie = cookieStore.get("RolUsuario")?.value ?? null;
  const roleFromSession = session?.user?.roles?.[0] ?? null;
  const rolUsuario = roleFromCookie ?? roleFromSession;
  const orgNameFromCookie = cookieStore.get("OrgName")?.value ?? null;
  const orgIdFromSession = session?.user?.organizationId ?? null;
  const orgFromSession = orgIdFromSession
    ? await prisma.organization.findUnique({ where: { id: orgIdFromSession } })
    : orgNameFromCookie
      ? await prisma.organization.findFirst({ where: { name: decodeURIComponent(orgNameFromCookie) } })
      : null;

  const siteNameConfig = await prisma.systemConfiguration.findFirst({
    where: {
      organizationId: orgFromSession?.id ?? null,
      category: "general",
      key: "site_name",
    },
    select: { value: true },
  });

  const fallbackConfig = !siteNameConfig
    ? await prisma.systemConfiguration.findFirst({
      where: { organizationId: null, category: "general", key: "site_name" },
      select: { value: true },
    })
    : null;

  const appName = siteNameConfig?.value?.trim() || fallbackConfig?.value?.trim() || "Modular Enterprise App";
  const livePermissionInfo = session?.user?.id
    ? await getUserRolesAndPermissions(session.user.id)
    : null;
  const permissions = livePermissionInfo?.permissions?.length
    ? livePermissionInfo.permissions
    : session?.user?.permissions?.length
      ? session.user.permissions
      : getRolePermissions(normalizeRole(rolUsuario));
  const ability = buildAbilityFromPermissions(permissions ?? []);

  if (!session?.user?.id && !rolUsuario) {
    redirect("/login");
  }

  const visibleNav = nav.filter((item) => ability.can("read", item.module));

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-md border bg-white">
              {orgFromSession?.logoUrl ? (
                <Image
                  alt={orgFromSession.name}
                  className="h-full w-full object-contain"
                  height={64}
                  src={orgFromSession.logoUrl}
                  width={128}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Logo</div>
              )}
            </div>
            <div className="text-sm font-semibold">{appName}</div>
          </div>
          <form
            action={async () => {
              "use server";
              const cookieStore = await cookies();
              cookieStore.set("RolUsuario", "", { maxAge: 0, path: "/" });
              cookieStore.set("OrgName", "", { maxAge: 0, path: "/" });
              cookieStore.set("EmailUsuario", "", { maxAge: 0, path: "/" });
              const currentSession = await auth();
              if (currentSession?.user?.id) {
                await signOut({ redirectTo: "/login" });
              }
              redirect("/login");
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <Card>
          <CardContent className="p-3">
            <DashboardNav nav={visibleNav} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">{children}</CardContent>
        </Card>
      </div>
      <StatusBar />
    </div>
  );
}
