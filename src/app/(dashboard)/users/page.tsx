"use client";

import { useEffect, useState } from "react";

type UserItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const response = await fetch("/api/users");
      const result = await response.json();
      if (mounted && result?.data?.items) {
        setUsers(result.data.items);
      }
      if (mounted) {
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
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      {loading ? <p>Cargando...</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-b" key={user.id}>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}</td>
                <td className="px-3 py-2">{user.status}</td>
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>
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
