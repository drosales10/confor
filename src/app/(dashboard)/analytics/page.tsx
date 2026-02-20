export default function AnalyticsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Analítica</h1>
      <p className="text-sm">Vista de analítica preparada para integrar gráficos y exportación.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm">Chart 1</p>
          <div className="mt-2 h-40 rounded-md border" />
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm">Chart 2</p>
          <div className="mt-2 h-40 rounded-md border" />
        </div>
      </div>
    </div>
  );
}
