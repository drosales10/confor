"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("-");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/profile");
      const result = await response.json();
      const user = result?.data;
      setFirstName(user?.firstName ?? "");
      setLastName(user?.lastName ?? "");
      setAvatarUrl(user?.avatarUrl ?? null);
      const apiRole = user?.userRoles?.[0]?.role?.slug ?? "-";
      const sessionRole = typeof window !== "undefined" ? sessionStorage.getItem("RolUsuario") ?? apiRole : apiRole;
      setRole(sessionRole);
    }
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    const result = await response.json();
    setMessage(result.data ? "Perfil actualizado" : result.error ?? "Error al actualizar");
  }

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "Error al cargar la foto");
      }

      setAvatarUrl(result?.data?.avatarUrl ?? null);
      setMessage("Foto de perfil actualizada");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al cargar la foto");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function onRemoveAvatar() {
    setUploadingAvatar(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "Error al quitar la foto");
      }

      setAvatarUrl(null);
      setMessage("Foto de perfil eliminada");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al quitar la foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setChangingPassword(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "Error al cambiar la contraseña");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Contraseña actualizada");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Error al cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <div className="max-w-md space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-medium">Foto de usuario</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Sin foto</span>
            )}
          </div>
          <div>
            <input type="file" accept="image/*" onChange={onAvatarChange} disabled={uploadingAvatar} />
            <p className="text-xs text-muted-foreground">Selecciona una imagen para tu perfil.</p>
            <button
              type="button"
              className="mt-2 rounded-md border px-3 py-1 text-sm disabled:opacity-60"
              onClick={onRemoveAvatar}
              disabled={!avatarUrl || uploadingAvatar}
            >
              Quitar foto
            </button>
          </div>
        </div>
      </div>

      <form className="max-w-md space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-md border px-3 py-2"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Nombre"
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Apellido"
        />
        <input className="w-full rounded-md border px-3 py-2" value={role} readOnly placeholder="Rol" />
        <button className="rounded-md border px-4 py-2" type="submit">
          Guardar
        </button>
      </form>

      <form className="max-w-md space-y-3 rounded-md border p-4" onSubmit={onChangePassword}>
        <h2 className="text-lg font-medium">Cambiar contraseña</h2>
        <input
          className="w-full rounded-md border px-3 py-2"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Contraseña actual"
          required
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nueva contraseña"
          required
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar nueva contraseña"
          required
        />
        <button className="rounded-md border px-4 py-2 disabled:opacity-60" type="submit" disabled={changingPassword}>
          {changingPassword ? "Actualizando..." : "Actualizar contraseña"}
        </button>
        {passwordMessage ? <p className="text-sm">{passwordMessage}</p> : null}
      </form>

      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
