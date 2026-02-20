import { z } from "zod";
import { emailSchema, paginationSchema, uuidSchema } from "@/validations/common.schema";

export const createUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  roleSlug: z.string().min(2),
  password: z.string().min(8),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED", "PENDING_VERIFICATION", "DELETED"]).optional(),
});

export const getUsersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED", "PENDING_VERIFICATION", "DELETED"]).optional(),
  role: z.string().optional(),
});

export const userIdParamSchema = z.object({
  id: uuidSchema,
});
