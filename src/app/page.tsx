import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <main className="w-full max-w-3xl rounded-xl border p-8">
        <h1 className="text-3xl font-semibold">Modular Enterprise App</h1>
        <p className="mt-3 text-sm">
          Plataforma full-stack con autenticación, gestión de usuarios, dashboard, configuración y auditoría.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-md border px-4 py-2 text-sm" href="/login">
            Iniciar sesión
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm" href="/register">
            Registrarse
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm" href="/dashboard">
            Ir al dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
