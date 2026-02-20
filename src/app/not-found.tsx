import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center p-6">
      <div className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">404 - Página no encontrada</h1>
        <Link className="mt-4 inline-block rounded-md border px-4 py-2 text-sm" href="/">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
