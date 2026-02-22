import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  rif: z.string().min(2).max(60),
});
