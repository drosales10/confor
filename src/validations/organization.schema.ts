import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  rif: z.string().min(2).max(60),
  countryId: z.string().uuid("Seleccione un país válido").optional().or(z.literal("")),
});
