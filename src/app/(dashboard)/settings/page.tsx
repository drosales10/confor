import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <div className="flex flex-wrap gap-2">
        <Link className="rounded-md border px-4 py-2 text-sm" href="/settings/system">
          Configuración del sistema
        </Link>
        <Link className="rounded-md border px-4 py-2 text-sm" href="/settings/notifications">
          Preferencias de notificación
        </Link>
      </div>
    </div>
  );
}
