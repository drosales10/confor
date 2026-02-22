"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_ROLES, canAccessUsers, normalizeRole } from "@/lib/rbac";

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

export default function UsersPage() {
  const router = useRouter();
  const rolUsuario = normalizeRole(typeof window !== "undefined" ? sessionStorage.getItem("RolUsuario") : null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingUser, setEditingUser] = useState<InvitedUser | null>(null);
  const [editForm, setEditForm] = useState({ role: "USER", organizationId: "", status: "ACTIVE" });
  const [form, setForm] = useState({
    email: "",
    role: "USER",
    organizationId: "",
    temporaryPassword: "",
  });

  useEffect(() => {
    if (!canAccessUsers(rolUsuario)) {
      router.replace("/unauthorized");
      return;
    }
    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        const [orgResponse, usersResponse] = await Promise.all([
          fetch("/api/organizations"),
          fetch("/api/users"),
        ]);

        if (!orgResponse.ok) {
          throw new Error("No fue posible cargar organizaciones");
        }

        if (!usersResponse.ok) {
          throw new Error("No fue posible cargar usuarios");
        }

        const orgPayload = await orgResponse.json();
        const usersPayload = await usersResponse.json();

        setOrganizations(orgPayload?.data?.items ?? []);
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
        setForm((prev) => ({
          ...prev,
          organizationId: prev.organizationId || orgPayload?.data?.items?.[0]?.id || "",
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [rolUsuario, router]);

  const canInvite = useMemo(() => rolUsuario === "ADMIN" || rolUsuario === "SUPER_ADMIN", [rolUsuario]);

  function onSubmitInvite(event: FormEvent) {
    event.preventDefault();

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
          role: "USER",
          organizationId: organizations[0]?.id ?? "",
          temporaryPassword: "",
        });
        setShowInviteForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    void submit();
  }

  if (!rolUsuario || !canAccessUsers(rolUsuario)) {
    return <p className="text-sm">Validando permisos...</p>;
  }

  const canApprove = rolUsuario === "ADMIN" || rolUsuario === "SUPER_ADMIN";
  const canManage = rolUsuario === "ADMIN" || rolUsuario === "SUPER_ADMIN";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  function onEdit(user: InvitedUser) {
    setEditForm({
      role: user.role === "-" ? "USER" : user.role,
      organizationId: user.organizationId ?? "",
      status: user.status === "-" ? "PENDING_VERIFICATION" : user.status,
    });
    setEditingUser(user);
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    if (!editForm.organizationId) {
      setError("La organización es obligatoria para actualizar el usuario");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  async function onDelete(user: InvitedUser) {
    if (!window.confirm(`Eliminar usuario ${user.email}?`)) return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        {canInvite ? (
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setShowInviteForm(true)}
            type="button"
          >
            + Invitar Usuario
          </button>
        ) : null}
      </div>

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
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            value={form.role}
          >
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
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
              disabled={organizations.length === 0}
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
            onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
            value={editForm.role}
          >
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
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
            {[
              "ACTIVE",
              "INACTIVE",
              "LOCKED",
              "PENDING_VERIFICATION",
              "DELETED",
            ].map((status) => (
              <option key={status} value={status}>
                {status}
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
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Organización</th>
              <th className="px-3 py-2">Fecha de Registro</th>
              <th className="px-3 py-2">Estado</th>
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
                <td className="px-3 py-2">{user.status}</td>
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
    </div>
  );
}
