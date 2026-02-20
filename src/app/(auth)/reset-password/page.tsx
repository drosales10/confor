"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });

    const result = await response.json();
    setMessage(result.data?.message ?? result.error ?? "Solicitud procesada");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" type="submit">
          Guardar
        </button>
      </form>
    </main>
  );
}
