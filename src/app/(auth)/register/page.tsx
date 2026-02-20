"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    };

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "No fue posible registrar la cuenta");
      return;
    }

    setMessage("Registro exitoso. Revisa tu correo de verificación.");
    setTimeout(() => router.push("/login"), 900);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Registro</h1>
        <div className="mt-4 grid gap-3">
          <input className="rounded-md border px-3 py-2" name="firstName" placeholder="Nombre" required />
          <input className="rounded-md border px-3 py-2" name="lastName" placeholder="Apellido" required />
          <input className="rounded-md border px-3 py-2" name="email" type="email" placeholder="Correo" required />
          <input className="rounded-md border px-3 py-2" name="password" type="password" placeholder="Contraseña" required />
          <input
            className="rounded-md border px-3 py-2"
            name="confirmPassword"
            type="password"
            placeholder="Confirmar contraseña"
            required
          />
        </div>
        {message ? <p className="mt-3 text-sm text-green-600">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" disabled={loading} type="submit">
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
