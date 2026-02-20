"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/profile");
      const result = await response.json();
      const user = result?.data;
      setFirstName(user?.firstName ?? "");
      setLastName(user?.lastName ?? "");
    }
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    const result = await response.json();
    setMessage(result.data ? "Perfil actualizado" : result.error ?? "Error al actualizar");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <form className="max-w-md space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-md border px-3 py-2"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Nombre"
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Apellido"
        />
        <button className="rounded-md border px-4 py-2" type="submit">
          Guardar
        </button>
      </form>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
