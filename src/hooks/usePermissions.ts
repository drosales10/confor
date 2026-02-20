"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data } = useSession();
  const permissions = data?.user?.permissions ?? [];

  const can = (module: string, action: string) => {
    return permissions.includes(`${module}:${action}`) || permissions.includes(`${module}:ADMIN`);
  };

  return { permissions, can };
}
