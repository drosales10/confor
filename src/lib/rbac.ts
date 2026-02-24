export const APP_ROLES = ["SUPER_ADMIN", "ADMIN", "CONTADOR", "GERENTE_CAMPO", "USER"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function normalizeRole(value: string | null | undefined): AppRole | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return APP_ROLES.includes(normalized as AppRole) ? (normalized as AppRole) : null;
}

export function inferRoleFromEmail(email: string): AppRole {
  const normalized = email.trim().toLowerCase();
  if (normalized.includes("admin")) return "ADMIN";
  if (normalized.includes("gerente")) return "GERENTE_CAMPO";
  if (normalized.includes("contador")) return "CONTADOR";
  return "USER";
}

export function canAccessOrganizations(role: AppRole | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canAccessUsers(role: AppRole | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "GERENTE_CAMPO";
}

export function getRolePermissions(role: AppRole | null) {
  if (!role) return [];

  if (role === "ADMIN") {
    return [
      "forest-patrimony:READ",
      "forest-patrimony:CREATE",
      "forest-patrimony:UPDATE",
      "forest-patrimony:DELETE",
      "forest-biological-asset:READ",
      "users:READ",
      "users:CREATE",
      "users:UPDATE",
      "users:DELETE",
    ];
  }

  if (role === "SUPER_ADMIN") {
    return ["dashboard:READ", "users:ADMIN", "organizations:ADMIN", "forest-patrimony:ADMIN", "forest-biological-asset:ADMIN", "forest-config:ADMIN", "general-config:ADMIN", "profile:ADMIN", "analytics:ADMIN", "settings:ADMIN", "audit:ADMIN"];
  }

  if (role === "GERENTE_CAMPO") {
    return [
      "forest-patrimony:READ",
      "forest-biological-asset:READ",
      "users:READ",
    ];
  }

  if (role === "CONTADOR") {
    return ["forest-patrimony:READ"];
  }

  if (role === "USER") {
    return ["dashboard:READ"];
  }

  return [];
}