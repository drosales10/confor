"use client";

import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { Trash2 } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function deleteLog(id: string) {
    if (!window.confirm("¿Está seguro de eliminar este registro de auditoría?")) return;
    try {
      const response = await fetch(`/api/audit/${id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "No se pudo eliminar el registro");

      setLogs((prev) => prev.filter((l) => l.id !== id));
      sileo.success({ title: "Registro eliminado", description: "El registro de auditoría ha sido borrado exitosamente." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "Error al eliminar", description: message });
    }
  }

  async function deleteAllLogs() {
    if (!window.confirm("¿Está seguro de eliminar TODOS los registros de auditoría? Esta acción no se puede deshacer.")) return;
    try {
      const response = await fetch("/api/audit", { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "No se pudieron eliminar los registros");

      setLogs([]);
      sileo.success({ title: "Registros eliminados", description: "Todos los registros de auditoría han sido borrados exitosamente." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "Error al eliminar", description: message });
    }
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        {!loading && logs.length > 0 && (
          <button
            onClick={() => void deleteAllLogs()}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar todo
          </button>
        )}
      </div>
      {loading ? <p>Cargando...</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 w-12 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr className="border-b" key={log.id}>
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2">{log.entityType ?? "-"}</td>
                <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => void deleteLog(log.id)}
                    className="p-1.5 inline-flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    title="Eliminar registro"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && logs.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-center text-muted-foreground" colSpan={4}>
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
