"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { useDebounce } from "@/hooks/useDebounce";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TablePagination } from "@/components/tables/TablePagination";
import { SortableHeader } from "@/components/tables/SortableHeader";

const CRUD_ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;
const ACTION_ORDER = ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT", "ADMIN"] as const;

type PermissionRef = {
  permissionId: string;
  moduleSlug: string;
  action: string;
};

type RoleItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  organizationId: string | null;
  organizationName?: string | null;
  isSystemRole: boolean;
  permissions: PermissionRef[];
};

type ModuleAction = {
  permissionId: string;
  action: string;
};

type ModuleItem = {
  id: string;
  name: string;
  slug: string;
  actions: ModuleAction[];
};

type OrganizationItem = {
  id: string;
  name: string;
};

type SortKey = "name" | "slug" | "organizationName" | "isSystemRole" | "permissionsCount";
const sortableKeys = ["name", "slug", "organizationName", "isSystemRole", "permissionsCount"] as const;

function isSortKey(value: string): value is SortKey {
  return (sortableKeys as ReadonlyArray<string>).includes(value);
}

export default function RolesPage() {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLimit, setExportLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [editingRoleMetaId, setEditingRoleMetaId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", slug: "", description: "" });
  const canReadUsers = permissions.includes("users:READ") || permissions.includes("users:ADMIN");
  const canCreateRole = permissions.includes("users:CREATE") || permissions.includes("users:ADMIN");
  const canUpdateRole = permissions.includes("users:UPDATE") || permissions.includes("users:ADMIN");
  const canDeleteRole = permissions.includes("users:DELETE") || permissions.includes("users:ADMIN");
  const canExport = permissions.includes("users:EXPORT") || permissions.includes("users:ADMIN");
  const canImport = canCreateRole;
  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) ?? null,
    [organizations, selectedOrganizationId],
  );

  async function refreshRoles(organizationId: string) {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    const response = await fetch(`/api/roles${query}`);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "No fue posible cargar roles y permisos");
    }

    const payload = await response.json();
    setRoles(payload?.data?.roles ?? []);
    setModules(payload?.data?.modules ?? []);
  }

  async function downloadExport(format: "csv" | "xlsx") {
    try {
      setExporting(true);
      setError(null);

      const params = new URLSearchParams({
        format,
        limit: String(exportLimit),
      });

      if (selectedOrganizationId) {
        params.set("organizationId", selectedOrganizationId);
      }

      const nextSearch = debouncedSearch.trim();
      if (nextSearch) {
        params.set("search", nextSearch);
      }

      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const response = await fetch(`/api/roles/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar roles");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `roles.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      sileo.success({
        title: "Exportación lista",
        description: `Se generó el archivo correctamente (máx. ${exportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo exportar",
        description: message,
      });
    } finally {
      setExporting(false);
    }
  }

  async function onImportRoles(file: File) {
    try {
      setImporting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      if (selectedOrganizationId) {
        formData.append("organizationId", selectedOrganizationId);
      }

      const response = await fetch("/api/roles/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar roles");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; slug?: string; error: string }>;
          }
        | undefined;

      await refreshRoles(selectedOrganizationId);

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
        sileo.success({
          title: "Importación completada",
          description,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo importar",
        description: message,
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const sessionResponse = await fetch("/api/auth/session");
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
        const sessionPermissions = (sessionPayload?.user?.permissions ?? []) as string[];
        setPermissions(sessionPermissions);

        const hasReadUsers = sessionPermissions.includes("users:READ") || sessionPermissions.includes("users:ADMIN");
        if (!hasReadUsers) {
          router.replace("/unauthorized");
          return;
        }

        const orgResponse = await fetch("/api/organizations");
        if (!orgResponse.ok) {
          throw new Error("No fue posible cargar organizaciones");
        }
        const orgPayload = await orgResponse.json().catch(() => null);
        const orgItems = (orgPayload?.data?.items ?? []) as OrganizationItem[];
        setOrganizations(orgItems);

        const sessionOrgId = sessionPayload?.user?.organizationId ?? "";
        const initialOrgId = sessionOrgId || orgItems[0]?.id || "";
        if (initialOrgId) {
          setSelectedOrganizationId(initialOrgId);
        }

        setLoading(true);
        await refreshRoles(initialOrgId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        sileo.error({
          title: "No se pudo cargar",
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  const editingRole = useMemo(
    () => roles.find((role) => role.id === editingRoleId) ?? null,
    [roles, editingRoleId],
  );

  const selectedPermissionSet = useMemo(() => new Set(selectedPermissionIds), [selectedPermissionIds]);
  const deletableRoleIds = useMemo(() => roles.filter((role) => !role.isSystemRole).map((role) => role.id), [roles]);
  const selectedRoleSet = useMemo(() => new Set(selectedRoleIds), [selectedRoleIds]);

  useEffect(() => {
    if (!selectedOrganizationId) return;

    const reloadByOrganization = async () => {
      try {
        setError(null);
        setLoading(true);
        await refreshRoles(selectedOrganizationId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        sileo.error({
          title: "No se pudo cargar",
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void reloadByOrganization();
  }, [selectedOrganizationId]);

  function toggleSort(nextSortBy: string) {
    if (!isSortKey(nextSortBy)) {
      return;
    }

    const sortKey = nextSortBy;
    const isSameColumn = sortBy === sortKey;

    setPage(1);
    setSortBy(sortKey);
    setSortOrder(isSameColumn ? (sortOrder === "asc" ? "desc" : "asc") : "asc");
  }

  const filteredRoles = useMemo(() => {
    const trimmed = debouncedSearch.trim().toLowerCase();
    if (!trimmed) return roles;
    return roles.filter((role) => {
      const name = role.name?.toLowerCase() ?? "";
      const slug = role.slug?.toLowerCase() ?? "";
      const org = role.organizationName?.toLowerCase() ?? "";
      return name.includes(trimmed) || slug.includes(trimmed) || org.includes(trimmed);
    });
  }, [debouncedSearch, roles]);

  const sortedRoles = useMemo(() => {
    const direction = sortOrder === "asc" ? 1 : -1;
    const items = [...filteredRoles];
    items.sort((a, b) => {
      if (sortBy === "isSystemRole") {
        const left = a.isSystemRole ? 1 : 0;
        const right = b.isSystemRole ? 1 : 0;
        return (left - right) * direction;
      }

      if (sortBy === "permissionsCount") {
        return (a.permissions.length - b.permissions.length) * direction;
      }

      const left =
        sortBy === "slug"
          ? a.slug
          : sortBy === "organizationName"
            ? a.organizationName ?? ""
            : a.name;

      const right =
        sortBy === "slug"
          ? b.slug
          : sortBy === "organizationName"
            ? b.organizationName ?? ""
            : b.name;

      return String(left ?? "").localeCompare(String(right ?? ""), "es", { sensitivity: "base" }) * direction;
    });
    return items;
  }, [filteredRoles, sortBy, sortOrder]);

  const total = sortedRoles.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = useMemo(() => {
    const start = (safePage - 1) * limit;
    return sortedRoles.slice(start, start + limit);
  }, [limit, safePage, sortedRoles]);

  useEffect(() => {
    setSelectedRoleIds((prev) => prev.filter((id) => deletableRoleIds.includes(id)));
  }, [deletableRoleIds]);

  function openModal(role: RoleItem) {
    if (!canUpdateRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para actualizar roles.",
      });
      return;
    }
    setEditingRoleId(role.id);
    setSelectedPermissionIds(role.permissions.map((permission) => permission.permissionId));
    sileo.info({
      title: "Editando rol",
      description: `Ahora gestionas los permisos de ${role.name}.`,
    });
  }

  function openCreateRoleForm() {
    if (!canCreateRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para crear roles.",
      });
      return;
    }
    setEditingRoleMetaId(null);
    setRoleForm({ name: "", slug: "", description: "" });
  }

  function openEditRoleForm(role: RoleItem) {
    if (!canUpdateRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para editar roles.",
      });
      return;
    }
    setEditingRoleMetaId(role.id);
    setRoleForm({
      name: role.name,
      slug: role.slug,
      description: role.description ?? "",
    });
  }

  async function onSaveRole() {
    if (editingRoleMetaId ? !canUpdateRole : !canCreateRole) {
      sileo.warning({
        title: "Sin permisos",
        description: editingRoleMetaId
          ? "No tienes permisos para actualizar roles."
          : "No tienes permisos para crear roles.",
      });
      return;
    }

    const payload = {
      name: roleForm.name.trim(),
      slug: roleForm.slug.trim(),
      description: roleForm.description.trim() || undefined,
    };

    if (!payload.name || !payload.slug) {
      sileo.warning({
        title: "Datos incompletos",
        description: "Debes indicar nombre y slug.",
      });
      return;
    }

    try {
      setSavingRole(true);

      const response = await fetch(editingRoleMetaId ? `/api/roles/${editingRoleMetaId}` : "/api/roles", {
        method: editingRoleMetaId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "No fue posible guardar el rol");
      }

      const reload = await fetch("/api/roles");
      const reloadPayload = await reload.json();
      setRoles(reloadPayload?.data?.roles ?? []);

      sileo.success({
        title: editingRoleMetaId ? "Rol actualizado" : "Rol creado",
        description: `Se guardó el rol ${payload.name}.`,
      });

      setEditingRoleMetaId(null);
      setRoleForm({ name: "", slug: "", description: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({
        title: "No se pudo guardar el rol",
        description: message,
      });
    } finally {
      setSavingRole(false);
    }
  }

  async function executeDeleteRole(role: RoleItem) {
    if (!canDeleteRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para eliminar roles.",
      });
      return;
    }

    if (role.isSystemRole) {
      sileo.warning({
        title: "Rol protegido",
        description: "No puedes eliminar un rol del sistema.",
      });
      return;
    }

    try {
      setDeletingRoleId(role.id);
      const response = await fetch(`/api/roles/${role.id}`, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "No fue posible eliminar el rol");
      }

      setRoles((prev) => prev.filter((item) => item.id !== role.id));
      setSelectedRoleIds((prev) => prev.filter((id) => id !== role.id));
      sileo.success({
        title: "Rol eliminado",
        description: `Se eliminó el rol ${role.name}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setDeletingRoleId(null);
    }
  }

  function onDeleteRole(role: RoleItem) {
    if (!canDeleteRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para eliminar roles.",
      });
      return;
    }

    if (role.isSystemRole) {
      sileo.warning({
        title: "Rol protegido",
        description: "No puedes eliminar un rol del sistema.",
      });
      return;
    }

    sileo.action({
      title: "Confirmar eliminación",
      description: `Se eliminará el rol ${role.name}.`,
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteRole(role);
        },
      },
    });
  }

  function toggleRoleSelection(roleId: string, checked: boolean) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }
      return Array.from(next);
    });
  }

  function toggleSelectAllRoles(checked: boolean) {
    if (!checked) {
      setSelectedRoleIds([]);
      return;
    }
    setSelectedRoleIds(deletableRoleIds);
  }

  async function executeDeleteSelectedRoles(roleIds: string[]) {
    if (!canDeleteRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para eliminar roles.",
      });
      return;
    }

    if (roleIds.length === 0) {
      sileo.warning({
        title: "Sin selección",
        description: "Marca al menos un rol para eliminar.",
      });
      return;
    }

    try {
      setDeletingSelected(true);

      const results = await Promise.allSettled(
        roleIds.map(async (roleId) => {
          const response = await fetch(`/api/roles/${roleId}`, { method: "DELETE" });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error ?? "No fue posible eliminar uno de los roles");
          }
          return roleId;
        }),
      );

      const deletedIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value);

      const failedCount = results.length - deletedIds.length;

      if (deletedIds.length > 0) {
        setRoles((prev) => prev.filter((role) => !deletedIds.includes(role.id)));
      }
      setSelectedRoleIds([]);

      if (failedCount > 0) {
        sileo.warning({
          title: "Eliminación parcial",
          description: `Se eliminaron ${deletedIds.length} roles y ${failedCount} fallaron.`,
        });
      } else {
        sileo.success({
          title: "Roles eliminados",
          description: `Se eliminaron ${deletedIds.length} roles correctamente.`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({
        title: "No se pudieron eliminar roles",
        description: message,
      });
    } finally {
      setDeletingSelected(false);
    }
  }

  function onDeleteSelectedRoles() {
    if (selectedRoleIds.length === 0) {
      sileo.warning({
        title: "Sin selección",
        description: "Marca al menos un rol para eliminar.",
      });
      return;
    }

    const roleIds = [...selectedRoleIds];
    sileo.action({
      title: "Confirmar eliminación masiva",
      description: `Se eliminarán ${roleIds.length} roles seleccionados.`,
      duration: 7000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteSelectedRoles(roleIds);
        },
      },
    });
  }

  function closeModal() {
    if (saving) return;
    setEditingRoleId(null);
    setSelectedPermissionIds([]);
  }

  function togglePermission(permissionId: string, enabled: boolean) {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }
      return Array.from(next);
    });
  }

  function toggleAllPermissions(enabled: boolean) {
    if (!enabled) {
      setSelectedPermissionIds([]);
      return;
    }

    const all = modules.flatMap((moduleItem) => moduleItem.actions.map((action) => action.permissionId));
    setSelectedPermissionIds(Array.from(new Set(all)));
  }

  function toggleModuleCrud(moduleItem: ModuleItem, enabled: boolean) {
    const crudPermissionIds = moduleItem.actions
      .filter((actionItem) => CRUD_ACTIONS.includes(actionItem.action as (typeof CRUD_ACTIONS)[number]))
      .map((actionItem) => actionItem.permissionId);

    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const permissionId of crudPermissionIds) {
        if (enabled) {
          next.add(permissionId);
        } else {
          next.delete(permissionId);
        }
      }
      return Array.from(next);
    });
  }

  async function onSavePermissions() {
    if (!editingRole) return;
    if (!canUpdateRole) {
      sileo.warning({
        title: "Sin permisos",
        description: "No tienes permisos para actualizar roles.",
      });
      return;
    }

    if (selectedPermissionIds.length === 0) {
      sileo.warning({
        title: "Sin permisos seleccionados",
        description: "Este rol quedará sin accesos si continúas con el guardado.",
      });
    }

    try {
      setSaving(true);

      const response = await fetch("/api/roles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleId: editingRole.id,
          permissionIds: selectedPermissionIds,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible guardar permisos");
      }

      setRoles((prev) =>
        prev.map((role) =>
          role.id === editingRole.id
            ? {
                ...role,
                permissions: modules
                  .flatMap((moduleItem) =>
                    moduleItem.actions.map((actionItem) => ({
                      permissionId: actionItem.permissionId,
                      moduleSlug: moduleItem.slug,
                      action: actionItem.action,
                    })),
                  )
                  .filter((item) => selectedPermissionSet.has(item.permissionId)),
              }
            : role,
        ),
      );

      sileo.success({
        title: "Permisos actualizados",
        description: `Se guardaron los permisos del rol ${editingRole.name}.`,
      });

      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      sileo.error({
        title: "No se pudo guardar",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !canReadUsers) {
    return <p className="text-sm">Validando permisos...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Roles y permisos</h1>
        <p className="text-sm text-muted-foreground">Gestiona permisos por módulo y acciones CRUD para cada rol.</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        {canImport ? (
          <>
            <input
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImportRoles(file);
              }}
              ref={importInputRef}
              type="file"
            />
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              Importar
            </button>
          </>
        ) : null}

        {canExport ? (
          <>
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={exporting}
              onClick={() => void downloadExport("csv")}
              type="button"
            >
              Exportar CSV
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={exporting}
              onClick={() => void downloadExport("xlsx")}
              type="button"
            >
              Exportar Excel
            </button>
          </>
        ) : null}
      </div>

      <div className="rounded-lg border p-3">
        <label className="text-sm font-semibold" htmlFor="organization-select">
          Organización activa
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="min-w-60 rounded-md border px-3 py-2 text-sm"
            id="organization-select"
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
            value={selectedOrganizationId}
            disabled
          >
            {organizations.length === 0 ? <option value="">Sin organizaciones</option> : null}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {activeOrganization ? (
            <span className="rounded-full border px-3 py-1 text-xs">Org activa: {activeOrganization.name}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">CRUD de roles</h2>
          {canCreateRole ? (
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={openCreateRoleForm} type="button">
              Nuevo rol
            </button>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nombre"
            value={roleForm.name}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setRoleForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="Slug"
            value={roleForm.slug}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descripción (opcional)"
            value={roleForm.description}
          />
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
            disabled={savingRole || (editingRoleMetaId ? !canUpdateRole : !canCreateRole)}
            onClick={() => void onSaveRole()}
            type="button"
          >
            {savingRole ? "Guardando..." : editingRoleMetaId ? "Actualizar rol" : "Crear rol"}
          </button>
          {editingRoleMetaId ? (
            <button
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={() => {
                setEditingRoleMetaId(null);
                setRoleForm({ name: "", slug: "", description: "" });
              }}
              type="button"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <p className="text-sm">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <TableToolbar
        canExport={canExport}
        exportLimit={exportLimit}
        limit={limit}
        onExportLimitChange={(value) => setExportLimit(value)}
        onLimitChange={(value) => {
          setPage(1);
          setLimit(value);
        }}
        onSearchChange={(value) => {
          setPage(1);
          setSearch(value);
        }}
        search={search}
        searchPlaceholder="Buscar roles"
        total={total}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">
                <input
                  checked={deletableRoleIds.length > 0 && selectedRoleIds.length === deletableRoleIds.length}
                  onChange={(event) => toggleSelectAllRoles(event.target.checked)}
                  type="checkbox"
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader label="Rol" onToggle={toggleSort} sortBy={sortBy} sortKey="name" sortOrder={sortOrder} />
              </th>
              <th className="px-3 py-2">
                <SortableHeader label="Slug" onToggle={toggleSort} sortBy={sortBy} sortKey="slug" sortOrder={sortOrder} />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Organización"
                  onToggle={toggleSort}
                  sortBy={sortBy}
                  sortKey="organizationName"
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Sistema"
                  onToggle={toggleSort}
                  sortBy={sortBy}
                  sortKey="isSystemRole"
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Permisos"
                  onToggle={toggleSort}
                  sortBy={sortBy}
                  sortKey="permissionsCount"
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pagedRoles.map((role) => (
              <tr className="border-b" key={role.id}>
                <td className="px-3 py-2">
                  <input
                    checked={selectedRoleSet.has(role.id)}
                    disabled={role.isSystemRole}
                    onChange={(event) => toggleRoleSelection(role.id, event.target.checked)}
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2">{role.name}</td>
                <td className="px-3 py-2">{role.slug}</td>
                <td className="px-3 py-2">{role.organizationName ?? "Global"}</td>
                <td className="px-3 py-2">{role.isSystemRole ? "Sí" : "No"}</td>
                <td className="px-3 py-2">{role.permissions.length}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border px-3 py-1.5 disabled:opacity-60"
                      disabled={!canUpdateRole}
                      onClick={() => openModal(role)}
                      type="button"
                    >
                      Permisos
                    </button>
                    <button
                      className="rounded-md border px-3 py-1.5 disabled:opacity-60"
                      disabled={!canUpdateRole}
                      onClick={() => openEditRoleForm(role)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border px-3 py-1.5 disabled:opacity-60"
                      disabled={!canDeleteRole || deletingRoleId === role.id || role.isSystemRole}
                      onClick={() => onDeleteRole(role)}
                      type="button"
                    >
                      {deletingRoleId === role.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && pagedRoles.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={7}>
                  No hay roles disponibles.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination
        loading={loading}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        page={safePage}
        total={total}
        totalPages={totalPages}
      />

      <div className="flex items-center gap-2">
        <button
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
          disabled={!canDeleteRole || selectedRoleIds.length === 0 || deletingSelected}
          onClick={() => onDeleteSelectedRoles()}
          type="button"
        >
          {deletingSelected ? "Eliminando seleccionados..." : `Eliminar seleccionados (${selectedRoleIds.length})`}
        </button>
      </div>

      {editingRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border-2 bg-gray-100 p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Permisos de {editingRole.name}</h2>
                <p className="text-sm text-muted-foreground">Marca o desmarca permisos por módulo y por CRUD.</p>
              </div>
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={closeModal} type="button">
                Cerrar
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => toggleAllPermissions(true)} type="button">
                Marcar todo
              </button>
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => toggleAllPermissions(false)} type="button">
                Desmarcar todo
              </button>
            </div>

            <div className="space-y-3">
              {modules.map((moduleItem) => {
                const actionMap = new Map(moduleItem.actions.map((actionItem) => [actionItem.action, actionItem.permissionId]));

                const orderedActions = Array.from(
                  new Set([
                    ...ACTION_ORDER.filter((action) => actionMap.has(action)),
                    ...moduleItem.actions.map((actionItem) => actionItem.action).filter((action) => !ACTION_ORDER.includes(action as (typeof ACTION_ORDER)[number])),
                  ]),
                );

                const moduleCrudPermissionIds = CRUD_ACTIONS
                  .map((action) => actionMap.get(action))
                  .filter((value): value is string => Boolean(value));

                const isCrudChecked =
                  moduleCrudPermissionIds.length > 0 &&
                  moduleCrudPermissionIds.every((permissionId) => selectedPermissionSet.has(permissionId));

                return (
                  <div className="rounded-lg border p-3" key={moduleItem.id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">{moduleItem.name}</div>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          checked={isCrudChecked}
                          onChange={(event) => toggleModuleCrud(moduleItem, event.target.checked)}
                          type="checkbox"
                        />
                        CRUD completo
                      </label>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      {orderedActions.map((action) => {
                        const permissionId = actionMap.get(action);
                        if (!permissionId) return null;

                        return (
                          <label className="inline-flex items-center gap-2 text-sm" key={`${moduleItem.id}-${action}`}>
                            <input
                              checked={selectedPermissionSet.has(permissionId)}
                              onChange={(event) => togglePermission(permissionId, event.target.checked)}
                              type="checkbox"
                            />
                            {action}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                disabled={saving || !canUpdateRole}
                onClick={() => void onSavePermissions()}
                type="button"
              >
                {saving ? "Guardando..." : "Guardar permisos"}
              </button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={closeModal} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
