import { z } from "zod";

export const updateSystemConfigSchema = z.object({
  category: z.string().min(1),
  key: z.string().min(1),
  value: z.string().optional(),
  configType: z.enum(["STRING", "INTEGER", "BOOLEAN", "JSON", "SECRET"]),
});

export const updateNotificationPrefsSchema = z.object({
  notificationType: z.string().min(1),
  channel: z.enum(["EMAIL", "IN_APP", "SMS", "PUSH"]),
  isEnabled: z.boolean(),
});
