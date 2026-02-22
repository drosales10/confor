import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { canAccessOrganizations, canAccessUsers, getRolePermissions, normalizeRole } from "@/lib/rbac";
import StatusBar from "@/components/StatusBar";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { prisma } from "@/lib/prisma";

const nav = [
  { href: "/dashboard", label: "Inicio", module: "dashboard" },
  { href: "/organizaciones", label: "Organizaciones", module: "organizations", onlyAdmin: true },
  { href: "/users", label: "Usuarios", module: "users", adminOrGerente: true },
  { href: "/roles", label: "Roles", module: "users", onlyAdmin: true },
  { href: "/patrimonio-forestal", label: "Patrimonio forestal", module: "forest-patrimony" },
  { href: "/activo-biologico", label: "Activo biológico", module: "forest-biological-asset" },
  { href: "/configuracion-forestal", label: "Configuración forestal", module: "forest-config" },
  { href: "/profile", label: "Perfil", module: "profile" },
  { href: "/analytics", label: "Analítica", module: "analytics" },
  { href: "/settings", label: "Configuración", module: "settings" },
  { href: "/audit", label: "Auditoría", module: "audit" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const siteNameConfig = await prisma.systemConfiguration.findFirst({
    where: { organizationId: null, category: "general", key: "site_name" },
    select: { value: true },
  });
  const appName = siteNameConfig?.value?.trim() || "Modular Enterprise App";
  const cookieStore = await cookies();
  const roleFromCookie = normalizeRole(cookieStore.get("RolUsuario")?.value ?? null);
  const roleFromSession = normalizeRole(session?.user?.roles?.[0] ?? null);
  const rolUsuario = roleFromCookie ?? roleFromSession;
  const permissions = session?.user?.permissions?.length
    ? session.user.permissions
    : getRolePermissions(rolUsuario);
  const ability = buildAbilityFromPermissions(permissions ?? []);

  if (!session?.user?.id && !rolUsuario) {
    redirect("/login");
  }

  const visibleNav = nav.filter((item) => {
    if (item.onlyAdmin && !canAccessOrganizations(rolUsuario)) return false;
    if (item.adminOrGerente && !canAccessUsers(rolUsuario)) return false;
    return ability.can("read", item.module);
  });

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="text-sm font-semibold">{appName}</div>
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
            <button className="rounded-md border px-3 py-1.5 text-sm" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border p-3">
          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-accent" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="rounded-xl border p-4">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
