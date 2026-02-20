"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center p-6">
      <div className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Error inesperado</h1>
        <button className="mt-4 rounded-md border px-4 py-2 text-sm" onClick={reset} type="button">
          Reintentar
        </button>
      </div>
    </main>
  );
}
