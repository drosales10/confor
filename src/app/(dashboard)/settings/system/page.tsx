"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { sileo } from "sileo";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TablePagination } from "@/components/tables/TablePagination";
import { SortableHeader } from "@/components/tables/SortableHeader";

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

type ConfigSortKey = "category" | "key" | "configType" | "value" | "updatedAt";

function isConfigSortKey(value: string): value is ConfigSortKey {
  return ["category", "key", "configType", "value", "updatedAt"].includes(value);
}

export default function SystemSettingsPage() {
  const router = useRouter();
  const importConfigInputRef = useRef<HTMLInputElement | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [configsImporting, setConfigsImporting] = useState(false);
  const [configsExporting, setConfigsExporting] = useState(false);
  const [configsExportLimit, setConfigsExportLimit] = useState(100);
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
  const [modulesSearch, setModulesSearch] = useState("");
  const debouncedModulesSearch = useDebounce(modulesSearch, 300);
  const [modulesPage, setModulesPage] = useState(1);
  const [modulesLimit, setModulesLimit] = useState(25);
  const [configsSearch, setConfigsSearch] = useState("");
  const debouncedConfigsSearch = useDebounce(configsSearch, 300);
  const [configsPage, setConfigsPage] = useState(1);
  const [configsLimit, setConfigsLimit] = useState(25);
  const [configsSortBy, setConfigsSortBy] = useState<ConfigSortKey>("updatedAt");
  const [configsSortOrder, setConfigsSortOrder] = useState<"asc" | "desc">("desc");
  const canReadSettings = permissions.includes("settings:READ") || permissions.includes("settings:ADMIN");
  const canUpdateSettings = permissions.includes("settings:UPDATE") || permissions.includes("settings:ADMIN");
  const canUpdateOrganization = permissions.includes("organizations:UPDATE") || permissions.includes("organizations:ADMIN");
  const canExportSettings = permissions.includes("settings:EXPORT") || permissions.includes("settings:ADMIN");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadConfigs = useCallback(async () => {
    const response = await fetch("/api/config");
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "No fue posible cargar configuración");
    }

    const configPayload = await response.json();
    const configItems = (configPayload?.data ?? []) as SystemConfigItem[];
    setConfigs(configItems);

    const siteName = configItems.find((item) => item.category === "general" && item.key === "site_name");
    if (siteName) {
      setCategory(siteName.category);
      setKeyName(siteName.key);
      setValue(siteName.value ?? "");
      setConfigType(siteName.configType);
    }
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
        const [modulesResponse, profileResponse] = await Promise.all([fetch("/api/modules"), fetch("/api/profile")]);

        if (!modulesResponse.ok) {
          const payload = await modulesResponse.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible cargar módulos");
        }

        if (!profileResponse.ok) {
          const payload = await profileResponse.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible cargar organización");
        }

        const modulesPayload = await modulesResponse.json();
        const profilePayload = await profileResponse.json();
        setModules((modulesPayload?.data ?? []) as ModuleItem[]);

        const org = profilePayload?.data?.organization ?? null;
        setOrganization(org ? { id: org.id, name: org.name ?? null, logoUrl: org.logoUrl ?? null } : null);

        await loadConfigs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        sileo.error({ title: "Carga fallida", description: message });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isClient, loadConfigs, router]);

  const selectedConfig = useMemo(
    () => configs.find((item) => item.category === category && item.key === keyName) ?? null,
    [configs, category, keyName],
  );

  const appTitle = useMemo(() => {
    const item = configs.find((entry) => entry.category === "general" && entry.key === "site_name");
    return item?.value?.trim() || "Modular Enterprise App";
  }, [configs]);

  const filteredModules = useMemo(() => {
    const term = debouncedModulesSearch.trim().toLowerCase();
    if (!term) return modules;
    return modules.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const slug = item.slug?.toLowerCase() ?? "";
      const route = item.routePath?.toLowerCase() ?? "";
      return name.includes(term) || slug.includes(term) || route.includes(term);
    });
  }, [debouncedModulesSearch, modules]);

  const modulesTotal = filteredModules.length;
  const modulesTotalPages = Math.max(1, Math.ceil(modulesTotal / modulesLimit));
  const safeModulesPage = Math.min(modulesPage, modulesTotalPages);
  const pagedModules = useMemo(() => {
    const start = (safeModulesPage - 1) * modulesLimit;
    return filteredModules.slice(start, start + modulesLimit);
  }, [filteredModules, modulesLimit, safeModulesPage]);

  const filteredConfigs = useMemo(() => {
    const term = debouncedConfigsSearch.trim().toLowerCase();
    const base = term
      ? configs.filter((item) => {
          const category = item.category?.toLowerCase() ?? "";
          const key = item.key?.toLowerCase() ?? "";
          const type = item.configType?.toLowerCase() ?? "";
          const value = (item.value ?? "").toLowerCase();
          return category.includes(term) || key.includes(term) || type.includes(term) || value.includes(term);
        })
      : configs;

    const direction = configsSortOrder === "asc" ? 1 : -1;
    return [...base].sort((left, right) => {
      if (configsSortBy === "updatedAt") {
        return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction;
      }

      const leftValue =
        configsSortBy === "category"
          ? left.category
          : configsSortBy === "key"
            ? left.key
            : configsSortBy === "configType"
              ? left.configType
              : left.value ?? "";

      const rightValue =
        configsSortBy === "category"
          ? right.category
          : configsSortBy === "key"
            ? right.key
            : configsSortBy === "configType"
              ? right.configType
              : right.value ?? "";

      return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "es", { sensitivity: "base" }) * direction;
    });
  }, [configs, configsSortBy, configsSortOrder, debouncedConfigsSearch]);

  function toggleConfigsSort(nextSortBy: string) {
    if (!isConfigSortKey(nextSortBy)) return;

    const isSameColumn = configsSortBy === nextSortBy;
    setConfigsPage(1);
    setConfigsSortBy(nextSortBy);
    setConfigsSortOrder(isSameColumn ? (configsSortOrder === "asc" ? "desc" : "asc") : "asc");
  }

  async function downloadConfigsExport(format: "csv" | "xlsx") {
    try {
      setConfigsExporting(true);

      const params = new URLSearchParams({
        format,
        limit: String(configsExportLimit),
        sortBy: configsSortBy,
        sortOrder: configsSortOrder,
      });

      const term = debouncedConfigsSearch.trim();
      if (term) {
        params.set("search", term);
      }

      const response = await fetch(`/api/config/export?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar configuración");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `system_config.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      sileo.success({
        title: "Exportación lista",
        description: `Se generó el archivo correctamente (máx. ${configsExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "No se pudo exportar", description: message });
    } finally {
      setConfigsExporting(false);
    }
  }

  async function onImportConfigs(file: File) {
    try {
      setConfigsImporting(true);
      setConfigsLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/config/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar configuración");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; key?: string; error: string }>;
          }
        | undefined;

      await loadConfigs();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

      if (errorCount > 0) {
        sileo.warning({
          title: "Importación parcial",
          description: `${description} · Errores: ${errorCount}`,
        });
      } else {
        sileo.success({ title: "Importación completada", description });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({ title: "No se pudo importar", description: message });
    } finally {
      setConfigsImporting(false);
      setConfigsLoading(false);
      if (importConfigInputRef.current) {
        importConfigInputRef.current.value = "";
      }
    }
  }

  const configsTotal = filteredConfigs.length;
  const configsTotalPages = Math.max(1, Math.ceil(configsTotal / configsLimit));
  const safeConfigsPage = Math.min(configsPage, configsTotalPages);
  const pagedConfigs = useMemo(() => {
    const start = (safeConfigsPage - 1) * configsLimit;
    return filteredConfigs.slice(start, start + configsLimit);
  }, [configsLimit, filteredConfigs, safeConfigsPage]);

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
                  className="h-full w-full object-contain"
                  height={48}
                  src={organization.logoUrl}
                  width={128}
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

        <TableToolbar
          limit={modulesLimit}
          onLimitChange={(value) => {
            setModulesPage(1);
            setModulesLimit(value);
          }}
          onSearchChange={(value) => {
            setModulesPage(1);
            setModulesSearch(value);
          }}
          search={modulesSearch}
          searchPlaceholder="Buscar módulos"
          total={modulesTotal}
        />

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
              {pagedModules.map((moduleItem) => (
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
              {pagedModules.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={5}>
                    No hay módulos registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={loading}
          onNext={() => setModulesPage((current) => Math.min(modulesTotalPages, current + 1))}
          onPrev={() => setModulesPage((current) => Math.max(1, current - 1))}
          page={safeModulesPage}
          total={modulesTotal}
          totalPages={modulesTotalPages}
        />
      </section>
      
<section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Parámetros de configuración</h2>
        <div className="flex flex-wrap gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportConfigs(file);
            }}
            ref={importConfigInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={configsImporting || !canUpdateSettings}
            onClick={() => importConfigInputRef.current?.click()}
            type="button"
          >
            {configsImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={configsExporting || !canExportSettings}
            onClick={() => void downloadConfigsExport("csv")}
            type="button"
          >
            {configsExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={configsExporting || !canExportSettings}
            onClick={() => void downloadConfigsExport("xlsx")}
            type="button"
          >
            {configsExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Formato esperado para importar: Categoria, Clave, Valor, Tipo, Publico, Editable.
          <span className="ml-1">Tipos válidos: STRING, INTEGER, BOOLEAN, JSON, SECRET.</span>
        </div>
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
        <h2 className="text-lg font-semibold">Configuraciones existentes</h2>

        <TableToolbar
          canExport
          exportLimit={configsExportLimit}
          limit={configsLimit}
          onExportLimitChange={(value) => setConfigsExportLimit(value)}
          onLimitChange={(value) => {
            setConfigsPage(1);
            setConfigsLimit(value);
          }}
          onSearchChange={(value) => {
            setConfigsPage(1);
            setConfigsSearch(value);
          }}
          search={configsSearch}
          searchPlaceholder="Buscar configuraciones"
          total={configsTotal}
        />

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2">
                  <SortableHeader label="Categoría" onToggle={toggleConfigsSort} sortBy={configsSortBy} sortKey="category" sortOrder={configsSortOrder} />
                </th>
                <th className="px-3 py-2">
                  <SortableHeader label="Clave" onToggle={toggleConfigsSort} sortBy={configsSortBy} sortKey="key" sortOrder={configsSortOrder} />
                </th>
                <th className="px-3 py-2">
                  <SortableHeader label="Tipo" onToggle={toggleConfigsSort} sortBy={configsSortBy} sortKey="configType" sortOrder={configsSortOrder} />
                </th>
                <th className="px-3 py-2">
                  <SortableHeader label="Valor" onToggle={toggleConfigsSort} sortBy={configsSortBy} sortKey="value" sortOrder={configsSortOrder} />
                </th>
                <th className="px-3 py-2">
                  <SortableHeader label="Actualizado" onToggle={toggleConfigsSort} sortBy={configsSortBy} sortKey="updatedAt" sortOrder={configsSortOrder} />
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedConfigs.map((item) => (
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
                  <td className="px-3 py-2">{new Date(item.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {pagedConfigs.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={5}>
                    No hay configuraciones registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={loading || configsLoading}
          onNext={() => setConfigsPage((current) => Math.min(configsTotalPages, current + 1))}
          onPrev={() => setConfigsPage((current) => Math.max(1, current - 1))}
          page={safeConfigsPage}
          total={configsTotal}
          totalPages={configsTotalPages}
        />
      </section>
    </div>
  );
}
