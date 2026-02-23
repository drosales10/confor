"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrganizationItem = {
  id: string;
  name: string;
  rif: string;
  createdAt: string;
};

export default function OrganizacionesPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", rif: "" });
  const canReadOrganizations = permissions.includes("organizations:READ") || permissions.includes("organizations:ADMIN");
  const canCreateOrganizations = permissions.includes("organizations:CREATE") || permissions.includes("organizations:ADMIN");

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
        const sessionPermissions = (sessionPayload?.user?.permissions ?? []) as string[];
        setPermissions(sessionPermissions);

        const hasRead = sessionPermissions.includes("organizations:READ") || sessionPermissions.includes("organizations:ADMIN");
        if (!hasRead) {
          router.replace("/unauthorized");
          return;
        }

        await loadOrganizations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  async function loadOrganizations() {
    try {
      setError(null);
      const response = await fetch("/api/organizations");
      if (!response.ok) {
        throw new Error("No fue posible cargar organizaciones");
      }
      const result = await response.json();
      setOrganizations(result?.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!canCreateOrganizations) {
      setError("No tienes permisos para crear organizaciones");
      return;
    }

    const submit = async () => {
      try {
        setError(null);
        const response = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, rif: form.rif }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible crear la organización");
        }

        const payload = await response.json();
        setOrganizations((prev) => [payload.data, ...prev]);
        setForm({ name: "", rif: "" });
        setShowModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    void submit();
  }

  if (loading && !canReadOrganizations) {
    return <p className="text-sm">Validando permisos...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Organizaciones</h1>
        {canCreateOrganizations ? (
          <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setShowModal(true)} type="button">
            + Nueva Organización
          </button>
        ) : null}
      </div>

      {loading ? <p className="text-sm">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">RIF</th>
              <th className="px-3 py-2">Fecha de Creación</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr className="border-b" key={organization.id}>
                <td className="px-3 py-2">{organization.id}</td>
                <td className="px-3 py-2">{organization.name}</td>
                <td className="px-3 py-2">{organization.rif}</td>
                <td className="px-3 py-2">{new Date(organization.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!loading && organizations.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>
                  Sin resultados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form className="w-full max-w-md space-y-3 rounded-xl border bg-background p-4" onSubmit={onSubmit}>
            <h2 className="text-lg font-semibold">Nueva Organización</h2>
            <input
              className="w-full rounded-md border px-3 py-2"
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nombre de la Organización"
              required
              value={form.name}
            />
            <input
              className="w-full rounded-md border px-3 py-2"
              onChange={(event) => setForm((prev) => ({ ...prev, rif: event.target.value }))}
              placeholder="RIF"
              required
              value={form.rif}
            />
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">
                Guardar
              </button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setShowModal(false)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
