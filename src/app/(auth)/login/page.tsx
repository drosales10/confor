"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { inferRoleFromEmail } from "@/lib/rbac";

type OrganizationItem = {
  id: string;
  name: string;
  rif?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [orgError, setOrgError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem("RolUsuario");
    document.cookie = "RolUsuario=; Max-Age=0; path=/; SameSite=Lax";
    document.cookie = "OrgName=; Max-Age=0; path=/; SameSite=Lax";
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setOrgError(null);
        const response = await fetch("/api/organizations");
        if (!response.ok) {
          throw new Error("No fue posible cargar organizaciones");
        }
        const payload = await response.json();
        const items = payload?.data?.items ?? [];
        setOrganizations(items);
        setOrganizationId(items[0]?.id ?? "");
      } catch (err) {
        setOrgError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const assignedRole = inferRoleFromEmail(email);
    const selectedOrganization = organizations.find((organization) => organization.id === organizationId) ?? null;
    sessionStorage.setItem("RolUsuario", assignedRole);
    sessionStorage.setItem("EmailUsuario", email);
    if (selectedOrganization) {
      sessionStorage.setItem("OrganizacionUsuario", selectedOrganization.id);
      sessionStorage.setItem("OrganizacionNombre", selectedOrganization.name);
    }
    document.cookie = `RolUsuario=${assignedRole}; path=/; SameSite=Lax`;
    if (selectedOrganization) {
      document.cookie = `OrgName=${encodeURIComponent(selectedOrganization.name)}; path=/; SameSite=Lax`;
    }

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setOrganizationId(event.target.value)}
            required={organizations.length > 0}
            value={organizationId}
          >
            {organizations.length === 0 ? <option value="">Sin organizaciones</option> : null}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
        {orgError ? <p className="mt-3 text-sm text-red-600">{orgError}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" disabled={loading} type="submit">
          {loading ? "Ingresando..." : "Iniciar Sesión"}
        </button>
        <p className="mt-3 text-center text-sm">
          <a className="underline" href="/register">
            Registrarse
          </a>
        </p>
      </form>
    </main>
  );
}
