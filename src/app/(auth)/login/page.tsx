"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciales inválidas");
      return;
    }

    router.push(searchParams.get("next") ?? "/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" disabled={loading} type="submit">
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
