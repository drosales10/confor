"use client";

import { useState } from "react";

export default function SystemSettingsPage() {
  const [category, setCategory] = useState("general");
  const [keyName, setKeyName] = useState("site_name");
  const [value, setValue] = useState("Modular Enterprise App");
  const [message, setMessage] = useState<string | null>(null);

  async function onSave() {
    const response = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, key: keyName, value, configType: "STRING" }),
    });
    const result = await response.json();
    setMessage(result.data ? "Configuración actualizada" : result.error ?? "Error");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Configuración del sistema</h1>
      <div className="max-w-lg space-y-3">
        <input className="w-full rounded-md border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        <textarea className="w-full rounded-md border px-3 py-2" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="rounded-md border px-4 py-2" onClick={onSave} type="button">
          Guardar
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
