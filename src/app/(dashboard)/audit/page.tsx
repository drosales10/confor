"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const response = await fetch("/api/audit");
      const result = await response.json();
      if (mounted) {
        setLogs(result?.data?.items ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      {loading ? <p>Cargando...</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr className="border-b" key={log.id}>
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2">{log.entityType ?? "-"}</td>
                <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>
                  Sin eventos
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
