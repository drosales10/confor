"use client";

import { useState } from "react";

export default function NotificationSettingsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(emailEnabled ? "Preferencias guardadas" : "Alertas críticas seguirán activas");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Preferencias de notificación</h1>
      <label className="flex items-center gap-2 text-sm">
        <input checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} type="checkbox" />
        Notificaciones por correo
      </label>
      <button className="rounded-md border px-4 py-2" onClick={save} type="button">
        Guardar
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
