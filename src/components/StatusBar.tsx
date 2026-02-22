"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const moduleLabels: Record<string, string> = {
  "/dashboard": "Inicio",
  "/organizaciones": "Organizaciones",
  "/users": "Usuarios",
  "/patrimonio-forestal": "Patrimonio forestal",
  "/activo-biologico": "Activo biologico",
  "/configuracion-forestal": "Configuracion forestal",
  "/profile": "Perfil",
  "/analytics": "Analitica",
  "/settings": "Configuracion",
  "/audit": "Auditoria",
};

function getModuleLabel(pathname: string) {
  const match = Object.keys(moduleLabels).find((route) => pathname === route || pathname.startsWith(route + "/"));
  return match ? moduleLabels[match] : "Modulo";
}

export default function StatusBar() {
  const pathname = usePathname();
  const moduleName = useMemo(() => getModuleLabel(pathname), [pathname]);
  const [now, setNow] = useState(() => new Date());
  const [ip, setIp] = useState<string>("-");
  const [mounted] = useState(() => typeof window !== "undefined");

  const userName = typeof window !== "undefined" ? sessionStorage.getItem("EmailUsuario") ?? "Usuario" : "Usuario";
  const userRole = typeof window !== "undefined" ? sessionStorage.getItem("RolUsuario") ?? "-" : "-";
  const organization =
    typeof window !== "undefined" ? sessionStorage.getItem("OrganizacionNombre") ?? "Sin organizacion" : "Sin organizacion";
  const project = typeof window !== "undefined" ? sessionStorage.getItem("ProyectoActual") ?? "Sin proyecto" : "Sin proyecto";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/status/ip")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setIp(data?.ip ?? "-");
      })
      .catch(() => {
        if (!active) return;
        setIp("-");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background px-4 py-2 text-xs">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <span>Usuario: {userName}</span>
          <span>Rol: {userRole}</span>
          <span>Organizacion: {organization}</span>
          <span>Proyecto: {project}</span>
          <span>Modulo: {moduleName}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <span>IP: {ip}</span>
          <span suppressHydrationWarning>Fecha: {mounted ? now.toLocaleString() : "--"}</span>
        </div>
      </div>
    </div>
  );
}
