import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { canAccessOrganizations, canAccessUsers, normalizeRole } from "@/lib/rbac";
import StatusBar from "@/components/StatusBar";

const nav = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/organizaciones", label: "Organizaciones", onlyAdmin: true },
  { href: "/users", label: "Usuarios", adminOrGerente: true },
  { href: "/patrimonio-forestal", label: "Patrimonio forestal" },
  { href: "/activo-biologico", label: "Activo biológico" },
  { href: "/configuracion-forestal", label: "Configuración forestal" },
  { href: "/profile", label: "Perfil" },
  { href: "/analytics", label: "Analítica" },
  { href: "/settings", label: "Configuración" },
  { href: "/audit", label: "Auditoría" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cookieStore = await cookies();
  const roleFromCookie = normalizeRole(cookieStore.get("RolUsuario")?.value ?? null);
  const roleFromSession = normalizeRole(session?.user?.roles?.[0] ?? null);
  const rolUsuario = roleFromCookie ?? roleFromSession;

  if (!session?.user?.id && !rolUsuario) {
    redirect("/login");
  }

  const visibleNav = nav.filter((item) => {
    if (rolUsuario === "USER") {
      return item.href === "/dashboard";
    }
    if (item.onlyAdmin) return canAccessOrganizations(rolUsuario);
    if (item.adminOrGerente) return canAccessUsers(rolUsuario);
    return true;
  });

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="text-sm font-semibold">Modular Enterprise App</div>
          <form
            action={async () => {
              "use server";
              const cookieStore = await cookies();
              cookieStore.set("RolUsuario", "", { maxAge: 0, path: "/" });
              cookieStore.set("OrgName", "", { maxAge: 0, path: "/" });
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
