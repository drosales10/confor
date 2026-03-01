export const userStatusLabels = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING_VERIFICATION: "Pendiente de verificación",
  LOCKED: "Bloqueado",
  DELETED: "Eliminado",
} as const;

export type UserStatusValue = keyof typeof userStatusLabels;

export function formatUserStatus(value: string | null | undefined) {
  if (!value) return "-";
  return (userStatusLabels as Record<string, string>)[value] ?? value;
}

export const notificationStatusLabels = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  DELIVERED: "Entregado",
  READ: "Leído",
  FAILED: "Fallido",
} as const;

export type NotificationStatusValue = keyof typeof notificationStatusLabels;

export function formatNotificationStatus(value: string | null | undefined) {
  if (!value) return "-";
  return (notificationStatusLabels as Record<string, string>)[value] ?? value;
}
