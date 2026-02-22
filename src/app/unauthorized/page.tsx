import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center p-6">
      <div className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">403 - Acceso denegado</h1>
        <p className="mt-2 text-sm">No tienes permisos para acceder a este recurso.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-md border px-4 py-2 text-sm" href="/login">
            Iniciar sesión
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm" href="/dashboard">
            Volver
          </Link>
        </div>
      </div>
    </main>
  );
}
