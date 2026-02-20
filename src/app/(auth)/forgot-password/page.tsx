"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    setMessage(result.data?.message ?? "Solicitud procesada");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
        <input
          className="mt-4 w-full rounded-md border px-3 py-2"
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" type="submit">
          Enviar enlace
        </button>
      </form>
    </main>
  );
}
