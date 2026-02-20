import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Usuarios" },
  { href: "/profile", label: "Perfil" },
  { href: "/analytics", label: "Analítica" },
  { href: "/settings", label: "Configuración" },
  { href: "/audit", label: "Auditoría" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="text-sm font-semibold">Modular Enterprise App</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
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
            {nav.map((item) => (
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-accent" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="rounded-xl border p-4">{children}</main>
      </div>
    </div>
  );
}
