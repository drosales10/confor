"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { sileo } from "sileo";
import Link from "next/link";

type SystemConfigItem = {
  id: string;
  category: string;
  key: string;
  value: string | null;
  configType: "STRING" | "INTEGER" | "BOOLEAN" | "JSON" | "SECRET";
  updatedAt: string;
};

type ModuleItem = {
  id: string;
  name: string;
  slug: string;
  routePath: string | null;
  displayOrder: number;
  isActive: boolean;
  permissions: Array<{ id: string; action: string }>;
};

type OrganizationInfo = {
  id: string;
  name: string | null;
  logoUrl: string | null;
};

export default function SystemSettingsPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [category, setCategory] = useState("general");
  const [keyName, setKeyName] = useState("site_name");
  const [value, setValue] = useState("Modular Enterprise App");
  const [configType, setConfigType] = useState<SystemConfigItem["configType"]>("STRING");
  const [moduleName, setModuleName] = useState("");
  const [moduleSlug, setModuleSlug] = useState("");
  const [routePath, setRoutePath] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const canReadSettings = permissions.includes("settings:READ") || permissions.includes("settings:ADMIN");
  const canUpdateSettings = permissions.includes("settings:UPDATE") || permissions.includes("settings:ADMIN");
  const canUpdateOrganization = permissions.includes("organizations:UPDATE") || permissions.includes("organizations:ADMIN");

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
        const sessionPermissions = (sessionPayload?.user?.permissions ?? []) as string[];
        setPermissions(sessionPermissions);

        const hasReadSettings = sessionPermissions.includes("settings:READ") || sessionPermissions.includes("settings:ADMIN");
        if (!hasReadSettings) {
          router.replace("/unauthorized");
          return;
        }

        setLoading(true);
        const [configResponse, modulesResponse, profileResponse] = await Promise.all([
          fetch("/api/config"),
          fetch("/api/modules"),
          fetch("/api/profile"),
        ]);

        if (!configResponse.ok) {
          const payload = await configResponse.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible cargar configuración");
        }

        if (!modulesResponse.ok) {
          const payload = await modulesResponse.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible cargar módulos");
        }

        if (!profileResponse.ok) {
          const payload = await profileResponse.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible cargar organización");
        }

        const configPayload = await configResponse.json();
        const modulesPayload = await modulesResponse.json();
        const profilePayload = await profileResponse.json();
        const configItems = (configPayload?.data ?? []) as SystemConfigItem[];
        setConfigs(configItems);
        setModules((modulesPayload?.data ?? []) as ModuleItem[]);

        const org = profilePayload?.data?.organization ?? null;
        setOrganization(org ? { id: org.id, name: org.name ?? null, logoUrl: org.logoUrl ?? null } : null);

        const siteName = configItems.find((item) => item.category === "general" && item.key === "site_name");
        if (siteName) {
          setCategory(siteName.category);
          setKeyName(siteName.key);
          setValue(siteName.value ?? "");
          setConfigType(siteName.configType);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        sileo.error({ title: "Carga fallida", description: message });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isClient, router]);

  const selectedConfig = useMemo(
    () => configs.find((item) => item.category === category && item.key === keyName) ?? null,
    [configs, category, keyName],
  );

  const appTitle = useMemo(() => {
    const item = configs.find((entry) => entry.category === "general" && entry.key === "site_name");
    return item?.value?.trim() || "Modular Enterprise App";
  }, [configs]);

  useEffect(() => {
    if (!selectedConfig) return;
    setValue(selectedConfig.value ?? "");
    setConfigType(selectedConfig.configType);
  }, [selectedConfig]);

  async function onSave() {
    if (!canUpdateSettings) {
      sileo.warning({ title: "Sin permisos", description: "No tienes permisos para actualizar configuración." });
      return;
    }

    try {
      setSavingConfig(true);
      const response = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, key: keyName, value, configType }),
      });
      const result = await response.json();
      if (!response.ok || !result?.data) {
        throw new Error(result?.error ?? "No fue posible actualizar la configuración");
      }

      const updated = result.data as SystemConfigItem;
      setConfigs((prev) => {
        const exists = prev.some((item) => item.id === updated.id);
        if (!exists) return [...prev, updated].sort((a, b) => `${a.category}:${a.key}`.localeCompare(`${b.category}:${b.key}`));
        return prev.map((item) => (item.id === updated.id ? updated : item));
      });

      sileo.success({
        title: "Configuración actualizada",
        description: `Se guardó ${category}.${keyName}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "No se pudo guardar", description: message });
    } finally {
      setSavingConfig(false);
    }
  }

  async function onCreateModule() {
    if (!canUpdateSettings) {
      sileo.warning({ title: "Sin permisos", description: "No tienes permisos para gestionar módulos." });
      return;
    }

    try {
      setSavingModule(true);
      const response = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: moduleName,
          slug: moduleSlug,
          routePath,
          displayOrder,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.data) {
        throw new Error(result?.error ?? "No fue posible crear/actualizar el módulo");
      }

      const nextModule = result.data as ModuleItem;
      setModules((prev) => {
        const exists = prev.some((item) => item.id === nextModule.id);
        const merged = exists ? prev.map((item) => (item.id === nextModule.id ? nextModule : item)) : [...prev, nextModule];
        return merged.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
      });

      setModuleName("");
      setModuleSlug("");
      setRoutePath("");
      setDisplayOrder((prev) => prev + 1);

      sileo.success({
        title: "Módulo guardado",
        description: "El módulo y sus permisos base fueron registrados.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "No se pudo guardar módulo", description: message });
    } finally {
      setSavingModule(false);
    }
  }

  async function onUploadLogo() {
    if (!canUpdateOrganization) {
      sileo.warning({ title: "Sin permisos", description: "No tienes permisos para actualizar el logo." });
      return;
    }

    if (!logoFile) {
      sileo.warning({ title: "Archivo requerido", description: "Selecciona un logo para continuar." });
      return;
    }

    try {
      sileo.info({ title: "Subiendo logo", description: "Esto puede tardar unos segundos." });
      setSavingLogo(true);
      const formData = new FormData();
      formData.append("file", logoFile);

      const response = await fetch("/api/organizations/logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data?.logoUrl) {
        throw new Error(result?.error ?? "No fue posible cargar el logo");
      }

      const profileResponse = await fetch("/api/profile");
      const profilePayload = await profileResponse.json().catch(() => null);
      if (profileResponse.ok && profilePayload?.data?.organization) {
        const org = profilePayload.data.organization;
        setOrganization({ id: org.id, name: org.name ?? null, logoUrl: org.logoUrl ?? null });
      } else {
        setOrganization((prev) => (prev ? { ...prev, logoUrl: result.data.logoUrl } : prev));
      }
      setLogoFile(null);
      sileo.success({ title: "Logo actualizado", description: "El logo de la organización se guardó correctamente." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "No se pudo actualizar logo", description: message });
    } finally {
      setSavingLogo(false);
    }
  }

  if (!isClient) {
    return <p className="text-sm">Cargando...</p>;
  }

  if (loading && !canReadSettings) {
    return <p className="text-sm">Validando permisos...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Configuración del sistema</h1>

      {loading ? <p className="text-sm">Cargando configuración...</p> : null}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Organización activa</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-md border bg-white">
              {organization?.logoUrl ? (
                <Image
                  alt={organization?.name ?? "Logo"}
                  className="h-full w-full object-cover"
                  height={48}
                  src={organization.logoUrl}
                  width={48}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sin logo</div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">{organization?.name ?? "Sin organización"}</div>
              <div className="text-xs text-muted-foreground">{appTitle}</div>
              <div className="text-xs text-muted-foreground">ID: {organization?.id ?? "-"}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              accept="image/*"
              className="block text-sm"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
              disabled={savingLogo || !logoFile || !canUpdateOrganization}
              onClick={() => void onUploadLogo()}
              type="button"
            >
              {savingLogo ? "Subiendo..." : "Subir logo"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Parámetros de configuración</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoría"
            value={category}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Clave"
            value={keyName}
          />
        </div>
        <select className="w-full rounded-md border px-3 py-2" onChange={(e) => setConfigType(e.target.value as SystemConfigItem["configType"])} value={configType}>
          {["STRING", "INTEGER", "BOOLEAN", "JSON", "SECRET"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <textarea
          className="w-full rounded-md border px-3 py-2"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valor"
          rows={4}
          value={value}
        />
        <button className="rounded-md border px-4 py-2 text-sm disabled:opacity-60" disabled={savingConfig || !canUpdateSettings} onClick={() => void onSave()} type="button">
          {savingConfig ? "Guardando..." : "Guardar configuración"}
        </button>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Módulos del sistema</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="Nombre del módulo"
            value={moduleName}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(e) => setModuleSlug(e.target.value)}
            placeholder="Slug (ej: inventario)"
            value={moduleSlug}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(e) => setRoutePath(e.target.value)}
            placeholder="Ruta (ej: /inventario)"
            value={routePath}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            min={0}
            onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
            placeholder="Orden"
            type="number"
            value={displayOrder}
          />
        </div>
        <button className="rounded-md border px-4 py-2 text-sm disabled:opacity-60" disabled={savingModule || !canUpdateSettings} onClick={() => void onCreateModule()} type="button">
          {savingModule ? "Guardando..." : "Crear/actualizar módulo"}
        </button>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Ruta</th>
                <th className="px-3 py-2">Permisos</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((moduleItem) => (
                <tr className="border-b" key={moduleItem.id}>
                  <td className="px-3 py-2">{moduleItem.name}</td>
                  <td className="px-3 py-2">{moduleItem.slug}</td>
                  <td className="px-3 py-2">{moduleItem.routePath}</td>
                  <td className="px-3 py-2">{moduleItem.permissions.map((permission) => permission.action).join(", ")}</td>
                  <td className="px-3 py-2">
                    <Link className="rounded-md border px-3 py-1.5 text-sm" href="/roles">
                      Editar permisos
                    </Link>
                  </td>
                </tr>
              ))}
              {modules.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={5}>
                    No hay módulos registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Configuraciones existentes</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Clave</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((item) => (
                <tr
                  className="cursor-pointer border-b hover:bg-accent"
                  key={item.id}
                  onClick={() => {
                    setCategory(item.category);
                    setKeyName(item.key);
                    setConfigType(item.configType);
                    setValue(item.value ?? "");
                  }}
                >
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.key}</td>
                  <td className="px-3 py-2">{item.configType}</td>
                  <td className="px-3 py-2">{item.value}</td>
                </tr>
              ))}
              {configs.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={4}>
                    No hay configuraciones registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
