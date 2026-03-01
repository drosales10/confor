"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { formatUserStatus, userStatusLabels } from "@/lib/enum-labels";
import { useDebounce } from "@/hooks/useDebounce";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TablePagination } from "@/components/tables/TablePagination";
import { SortableHeader } from "@/components/tables/SortableHeader";

type OrganizationItem = {
  id: string;
  name: string;
  createdAt: string;
};

type InvitedUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  registeredAt: string;
  status: string;
};

type ApiUserRole = {
  role?: {
    slug?: string | null;
  } | null;
} | null;

type ApiUser = {
  id: string;
  email: string;
  createdAt: string;
  status?: string | null;
  userRoles?: ApiUserRole[] | null;
  organization?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type RoleOption = {
  id: string;
  slug: string;
  name: string;
};

export default function UsersPage() {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLimit, setExportLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingUser, setEditingUser] = useState<InvitedUser | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editForm, setEditForm] = useState({ role: "USER", organizationId: "", status: "ACTIVE" });
  const [form, setForm] = useState({
    email: "",
    role: "USER",
    organizationId: "",
    temporaryPassword: "",
  });
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const hasUsersAdmin = permissionSet.has("users:ADMIN");
  const canReadUsers = hasUsersAdmin || permissionSet.has("users:READ");
  const canInvite = hasUsersAdmin || permissionSet.has("users:CREATE");
  const canApprove = hasUsersAdmin || permissionSet.has("users:UPDATE");
  const canManage = hasUsersAdmin || permissionSet.has("users:UPDATE") || permissionSet.has("users:DELETE");

  const canExport = hasUsersAdmin || permissionSet.has("users:EXPORT");

  const buildUsersQuery = useCallback(
    (opts?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: "asc" | "desc" }) => {
      const params = new URLSearchParams({
        page: String(opts?.page ?? page),
        limit: String(opts?.limit ?? limit),
        sortOrder: opts?.sortOrder ?? sortOrder,
      });

      const nextSearch = (opts?.search ?? debouncedSearch).trim();
      if (nextSearch) params.set("search", nextSearch);
      const nextSortBy = opts?.sortBy ?? sortBy;
      if (nextSortBy) params.set("sortBy", nextSortBy);

      return params;
    },
    [debouncedSearch, limit, page, sortBy, sortOrder],
  );

  async function refreshUsers(opts?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: "asc" | "desc" }) {
    const params = buildUsersQuery(opts);
    const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "No fue posible cargar usuarios");
    }
    const payload = await response.json();
    const items = (payload?.data?.items ?? []) as ApiUser[];
    const meta = payload?.data?.pagination;
    const mapped = items.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.userRoles?.[0]?.role?.slug ?? "-",
      organizationId: user.organization?.id ?? null,
      organizationName: user.organization?.name ?? null,
      registeredAt: user.createdAt,
      status: user.status ?? "-",
    }));
    setUsers(mapped);
    setPagination({
      page: meta?.page ?? (opts?.page ?? page),
      totalPages: meta?.totalPages ?? 1,
      total: meta?.total ?? 0,
      limit: meta?.limit ?? (opts?.limit ?? limit),
    });
  }

  async function downloadExport(format: "csv" | "xlsx") {
    try {
      setExporting(true);
      setError(null);

      const params = buildUsersQuery({ page: 1, limit: exportLimit });
      params.set("format", format);

      const response = await fetch(`/api/users/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar usuarios");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `users.${format}`;

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

  function toggleSort(nextSortBy: string) {
    setPage(1);
    setSortBy((current) => {
      if (current !== nextSortBy) {
        setSortOrder("asc");
        return nextSortBy;
      }

      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return current;
    });
  }

  async function onImportUsers(file: File) {
    try {
      setImporting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar usuarios");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; email?: string; error: string }>;
          }
        | undefined;

      await refreshUsers();

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
        setLoading(true);
        const sessionResponse = await fetch("/api/auth/session");
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
        const sessionPermissions = (sessionPayload?.user?.permissions ?? []) as string[];
        const sessionPermissionSet = new Set(sessionPermissions);
        const canCreateUsersNow = sessionPermissionSet.has("users:ADMIN") || sessionPermissionSet.has("users:CREATE");
        const canUpdateUsersNow = sessionPermissionSet.has("users:ADMIN") || sessionPermissionSet.has("users:UPDATE");
        const canDeleteUsersNow = sessionPermissionSet.has("users:ADMIN") || sessionPermissionSet.has("users:DELETE");
        const canReadRolesNow = sessionPermissionSet.has("users:ADMIN") || sessionPermissionSet.has("users:READ");

        setPermissions(sessionPermissions);

        const requests = [fetch("/api/organizations"), fetch("/api/users")];
        if (canCreateUsersNow || canUpdateUsersNow || canDeleteUsersNow || canReadRolesNow) {
          requests.push(fetch("/api/roles"));
        }

        const [orgResponse, usersResponse, rolesResponse] = await Promise.all(requests);

        if (!orgResponse.ok) {
          throw new Error("No fue posible cargar organizaciones");
        }

        if (usersResponse.status === 403) {
          router.replace("/unauthorized");
          return;
        }

        if (!usersResponse.ok) {
          throw new Error("No fue posible cargar usuarios");
        }

        const orgPayload = await orgResponse.json();
        const usersPayload = await usersResponse.json();
        const rolesPayload = rolesResponse?.ok ? await rolesResponse.json() : null;

        setOrganizations(orgPayload?.data?.items ?? []);
        const dynamicRoles = rolesResponse?.ok
          ? ((rolesPayload?.data?.roles ?? []) as Array<{ id: string; slug: string; name: string }>).map((role) => ({
              id: role.id,
              slug: role.slug,
              name: role.name,
            }))
          : [];
        setRoleOptions(dynamicRoles);

        const fallbackRole =
          dynamicRoles.find((role) => role.slug === "USER")?.slug ??
          dynamicRoles[0]?.slug ??
          "USER";

        const items = (usersPayload?.data?.items ?? []) as ApiUser[];
        const mapped = items.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.userRoles?.[0]?.role?.slug ?? "-",
          organizationId: user.organization?.id ?? null,
          organizationName: user.organization?.name ?? null,
          registeredAt: user.createdAt,
          status: user.status ?? "-",
        }));
        setUsers(mapped);
        setPagination(usersPayload?.data?.pagination ?? pagination);
        setForm((prev) => ({
          ...prev,
          role: dynamicRoles.some((role) => role.slug === prev.role) ? prev.role : fallbackRole,
          organizationId: prev.organizationId || orgPayload?.data?.items?.[0]?.id || "",
        }));
        setEditForm((prev) => ({
          ...prev,
          role: dynamicRoles.some((role) => role.slug === prev.role) ? prev.role : fallbackRole,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  useEffect(() => {
    if (!canReadUsers) return;
    void refreshUsers({ page: 1, limit, search: debouncedSearch, sortBy, sortOrder });
  }, [canReadUsers, debouncedSearch, limit, sortBy, sortOrder]);

  useEffect(() => {
    const maxPage = Math.max(1, pagination.totalPages);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pagination.totalPages]);

  useEffect(() => {
    if (!canReadUsers) return;
    void refreshUsers({ page, limit, search: debouncedSearch, sortBy, sortOrder });
  }, [canReadUsers, debouncedSearch, limit, page, sortBy, sortOrder]);

  function onSubmitInvite(event: FormEvent) {
    event.preventDefault();

    if (!form.role) {
      const message = "No hay roles disponibles para asignar";
      setError(message);
      sileo.warning({
        title: "Datos incompletos",
        description: message,
      });
      return;
    }

    const submit = async () => {
      try {
        setError(null);
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            roleSlug: form.role,
            organizationId: form.organizationId,
            password: form.temporaryPassword || undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "No fue posible invitar usuario");
        }

        const payload = await response.json();
        const created = payload?.data;
        const nextUser: InvitedUser = {
          id: created.id,
          email: created.email,
          role: created.userRoles?.[0]?.role?.slug ?? form.role,
          organizationId: created.organization?.id ?? null,
          organizationName: created.organization?.name ?? null,
          registeredAt: created.createdAt,
          status: created.status ?? "-",
        };

        setUsers((prev) => [nextUser, ...prev]);
        setForm({
          email: "",
          role: roleOptions.find((role) => role.slug === "USER")?.slug ?? roleOptions[0]?.slug ?? "",
          organizationId: organizations[0]?.id ?? "",
          temporaryPassword: "",
        });
        setShowInviteForm(false);
        sileo.success({
          title: "Usuario invitado",
          description: `Se invitó al usuario ${nextUser.email}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        sileo.error({
          title: "No se pudo invitar",
          description: message,
        });
      }
    };

    void submit();
  }

  if (loading && !canReadUsers) {
    return <p className="text-sm">Validando permisos...</p>;
  }

  async function onApprove(userId: string) {
    try {
      setError(null);
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible aprobar el usuario");
      }

      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, status: "ACTIVE" } : user)));
      sileo.success({
        title: "Usuario aprobado",
        description: "El usuario fue activado correctamente.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo aprobar",
        description: message,
      });
    }
  }

  function onEdit(user: InvitedUser) {
    const fallbackRole =
      roleOptions.find((role) => role.slug === "USER")?.slug ??
      roleOptions[0]?.slug ??
      "";
    const currentRole = user.role === "-" ? "" : user.role;

    setEditForm({
      role: roleOptions.some((role) => role.slug === currentRole) ? currentRole : fallbackRole,
      organizationId: user.organizationId ?? "",
      status: user.status === "-" ? "PENDING_VERIFICATION" : user.status,
    });
    setEditingUser(user);
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    if (!editForm.role) {
      const message = "No hay roles disponibles para asignar";
      setError(message);
      sileo.warning({
        title: "Datos incompletos",
        description: message,
      });
      return;
    }
    if (!editForm.organizationId) {
      const message = "La organización es obligatoria para actualizar el usuario";
      setError(message);
      sileo.warning({
        title: "Datos incompletos",
        description: message,
      });
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleSlug: editForm.role,
          organizationId: editForm.organizationId,
          status: editForm.status,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible actualizar el usuario");
      }

      const payload = await response.json();
      const updated = payload?.data;
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                role: updated.userRoles?.[0]?.role?.slug ?? editForm.role,
                organizationId: updated.organization?.id ?? user.organizationId,
                organizationName: updated.organization?.name ?? user.organizationName,
                status: updated.status ?? editForm.status,
              }
            : user,
        ),
      );
      setEditingUser(null);
      sileo.success({
        title: "Usuario actualizado",
        description: "Los cambios del usuario se guardaron correctamente.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    }
  }

  async function executeDeleteUser(user: InvitedUser) {
    try {
      setError(null);
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible eliminar el usuario");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      sileo.success({
        title: "Usuario eliminado",
        description: `Se eliminó el usuario ${user.email}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    }
  }

  function onDelete(user: InvitedUser) {
    sileo.action({
      title: "Confirmar eliminación",
      description: `Se eliminará el usuario ${user.email}.`,
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteUser(user);
        },
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <div className="flex items-center gap-2">
          {canInvite ? (
            <>
              <input
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onImportUsers(file);
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
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setShowInviteForm(true)}
                type="button"
              >
                + Invitar Usuario
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
      </div>

      {canReadUsers ? (
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
          searchPlaceholder="Buscar usuarios"
          total={pagination.total}
        />
      ) : null}

      {loading ? <p className="text-sm">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showInviteForm ? (
        <form className="space-y-3 rounded-lg border p-4" onSubmit={onSubmitInvite}>
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            required
            type="email"
            value={form.email}
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
            placeholder="Contraseña temporal (opcional)"
            type="password"
            value={form.temporaryPassword}
          />
          <select
            className="w-full rounded-md border px-3 py-2"
            disabled={roleOptions.length === 0}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            value={form.role}
          >
            {roleOptions.length === 0 ? <option value="">Sin roles disponibles</option> : null}
            {roleOptions.map((role) => (
              <option key={role.id} value={role.slug}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-md border px-3 py-2"
            disabled={organizations.length === 0}
            onChange={(event) => setForm((prev) => ({ ...prev, organizationId: event.target.value }))}
            required
            value={form.organizationId}
          >
            {organizations.length === 0 ? <option value="">Sin organizaciones</option> : null}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={organizations.length === 0 || roleOptions.length === 0}
              type="submit"
            >
              Guardar invitación
            </button>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setShowInviteForm(false)} type="button">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {editingUser ? (
        <form className="space-y-3 rounded-lg border p-4" onSubmit={onSaveEdit}>
          <div className="text-sm font-semibold">Editar usuario: {editingUser.email}</div>
          <select
            className="w-full rounded-md border px-3 py-2"
            disabled={roleOptions.length === 0}
            onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
            value={editForm.role}
          >
            {roleOptions.length === 0 ? <option value="">Sin roles disponibles</option> : null}
            {roleOptions.map((role) => (
              <option key={role.id} value={role.slug}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-md border px-3 py-2"
            disabled={organizations.length === 0}
            onChange={(event) => setEditForm((prev) => ({ ...prev, organizationId: event.target.value }))}
            value={editForm.organizationId}
          >
            {organizations.length === 0 ? <option value="">Sin organizaciones</option> : null}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-md border px-3 py-2"
            onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
            value={editForm.status}
          >
            {(Object.keys(userStatusLabels) as Array<keyof typeof userStatusLabels>).map((status) => (
              <option key={status} value={status}>
                {userStatusLabels[status]}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" type="submit">
              Guardar cambios
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => setEditingUser(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">
                <SortableHeader label="Email" onToggle={toggleSort} sortBy={sortBy} sortKey="email" sortOrder={sortOrder} />
              </th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Organización</th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Fecha de Registro"
                  onToggle={toggleSort}
                  sortBy={sortBy}
                  sortKey="createdAt"
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader label="Estado" onToggle={toggleSort} sortBy={sortBy} sortKey="status" sortOrder={sortOrder} />
              </th>
              {canApprove ? <th className="px-3 py-2">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-b" key={`${user.email}-${user.registeredAt}`}>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user.organizationName}</td>
                <td className="px-3 py-2">{new Date(user.registeredAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">{formatUserStatus(user.status)}</td>
                {canApprove ? (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {user.status !== "ACTIVE" ? (
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => onApprove(user.id)}
                          type="button"
                        >
                          Aprobar
                        </button>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => onEdit(user)}
                            type="button"
                          >
                            Editar
                          </button>
                          <button
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => onDelete(user)}
                            type="button"
                          >
                            Eliminar
                          </button>
                        </>
                      ) : null}
                      {!canManage && user.status === "ACTIVE" ? "-" : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={canApprove ? 6 : 5}>
                  Sin resultados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canReadUsers ? (
        <TablePagination
          loading={loading}
          onNext={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          page={pagination.page}
          total={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </div>
  );
}
