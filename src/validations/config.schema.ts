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

export const upsertModuleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  routePath: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  displayOrder: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().optional(),
});
