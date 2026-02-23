"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import Image from "next/image";

type OrganizationItem = {
  id: string;
  name: string;
  rif?: string;
};

type OrganizationBranding = {
  appTitle: string | null;
  organization: {
    id: string;
    name: string | null;
    logoUrl: string | null;
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [branding, setBranding] = useState<OrganizationBranding | null>(null);
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem("RolUsuario");
    document.cookie = "RolUsuario=; Max-Age=0; path=/; SameSite=Lax";
    document.cookie = "OrgName=; Max-Age=0; path=/; SameSite=Lax";
    document.cookie = "EmailUsuario=; Max-Age=0; path=/; SameSite=Lax";
  }, []);

  useEffect(() => {
    const loadBranding = async () => {
      if (!organizationId) {
        setBranding(null);
        return;
      }

      try {
        const response = await fetch(`/api/organizations/${organizationId}/branding`);
        if (!response.ok) {
          setBranding(null);
          return;
        }
        const payload = await response.json();
        setBranding(payload?.data ?? null);
      } catch {
        setBranding(null);
      }
    };

    void loadBranding();
  }, [organizationId]);

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
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas o usuario pendiente de aprobación");
      setLoading(false);
      return;
    }

    const selectedOrganization = organizations.find((organization) => organization.id === organizationId) ?? null;
    try {
      const session = await getSession();
      const roleSlug = session?.user?.roles?.[0] ?? null;
      const orgName = session?.user?.organizationName ?? selectedOrganization?.name ?? null;
      const orgId = session?.user?.organizationId ?? selectedOrganization?.id ?? null;

      if (roleSlug) {
        sessionStorage.setItem("RolUsuario", roleSlug);
        document.cookie = `RolUsuario=${roleSlug}; path=/; SameSite=Lax`;
      }

      sessionStorage.setItem("EmailUsuario", email);
      document.cookie = `EmailUsuario=${encodeURIComponent(email)}; path=/; SameSite=Lax`;

      if (orgId) {
        sessionStorage.setItem("OrganizacionUsuario", orgId);
      }
      if (orgName) {
        sessionStorage.setItem("OrganizacionNombre", orgName);
        document.cookie = `OrgName=${encodeURIComponent(orgName)}; path=/; SameSite=Lax`;
      }
    } catch {
      if (selectedOrganization) {
        sessionStorage.setItem("OrganizacionUsuario", selectedOrganization.id);
        sessionStorage.setItem("OrganizacionNombre", selectedOrganization.name);
        document.cookie = `OrgName=${encodeURIComponent(selectedOrganization.name)}; path=/; SameSite=Lax`;
      }
      sessionStorage.setItem("EmailUsuario", email);
      document.cookie = `EmailUsuario=${encodeURIComponent(email)}; path=/; SameSite=Lax`;
    }

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border p-6">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-lg border bg-white p-2 shadow-sm">
            {branding?.organization?.logoUrl ? (
              <Image
                alt={branding.organization.name ?? "Logo"}
                className="h-full w-full object-contain"
                height={64}
                src={branding.organization.logoUrl}
                width={128}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                {branding?.organization?.name ?? "Confor"}
              </div>
            )}
          </div>
          <div className="text-center">
            {branding?.appTitle ? (
              <div className="text-xl font-bold tracking-tight text-primary-foreground bg-primary/50 px-3 py-1 rounded-full mb-1">
                {branding.appTitle}
              </div>
            ) : null}
            <div className="text-2xl font-semibold tracking-tight">Iniciar sesión</div>
          </div>
        </div>
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
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button className="mt-4 w-full rounded-md border px-4 py-2" disabled={loading} type="submit">
          {loading ? "Ingresando..." : "Iniciar Sesión"}
        </button>
        <div className="mt-3 flex flex-col items-center gap-2 text-sm">
          <a className="underline" href="/forgot-password">
            ¿Olvidaste tu contraseña?
          </a>
          <a className="underline" href="/register">
            Registrarse
          </a>
        </div>
      </form>
    </main>
  );
}
