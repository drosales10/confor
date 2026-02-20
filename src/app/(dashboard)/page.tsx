async function getMetrics() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard/metrics`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export default async function DashboardPage() {
  const result = await getMetrics();
  const metrics = result?.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border p-3">
          <p className="text-sm">Usuarios totales</p>
          <p className="mt-1 text-2xl font-semibold">{metrics?.usersTotal ?? "-"}</p>
        </article>
        <article className="rounded-lg border p-3">
          <p className="text-sm">Usuarios activos</p>
          <p className="mt-1 text-2xl font-semibold">{metrics?.usersActive ?? "-"}</p>
        </article>
        <article className="rounded-lg border p-3">
          <p className="text-sm">Notificaciones pendientes</p>
          <p className="mt-1 text-2xl font-semibold">{metrics?.pendingNotifications ?? "-"}</p>
        </article>
        <article className="rounded-lg border p-3">
          <p className="text-sm">Eventos de auditoría</p>
          <p className="mt-1 text-2xl font-semibold">{metrics?.auditTotal ?? "-"}</p>
        </article>
      </div>
    </div>
  );
}
