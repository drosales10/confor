import { z } from "zod";
import { uuidSchema } from "@/validations/common.schema";

const nullableDate = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;

    if (value instanceof Date) return value;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T00:00:00`);
      }

      return new Date(trimmed);
    }

    return value;
  }, z.date().nullable())
  .optional();

const nullableNumber = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const normalized = value.trim().replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, z.number().nullable())
  .optional();

const nullableInt = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    if (typeof value === "number") return Math.trunc(value);
    if (typeof value === "string") {
      const normalized = value.trim().replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
  }, z.number().int().nullable())
  .optional();

const nullableString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    return value.length > 0 ? value : null;
  });

export const createBiologicalAssetSchema = z.object({
  level4Id: uuidSchema,
  biologicalAssetKey: z.string().trim().min(1).max(220),
  accountingKey: nullableString,
  establishmentDate: nullableDate,
  plantingYear: nullableInt,
  geneticMaterialCode: nullableString,
  geneticMaterialName: nullableString,
  assetType: z.enum(["COMERCIAL", "INVESTIGACION"]).default("COMERCIAL"),
  managementSchemeCode: nullableString,
  managementSchemeName: nullableString,
  inventoryCode: nullableString,
  inventoryType: nullableString,
  inventoryDate: nullableDate,
  inventoryAgeYears: nullableInt,
  level5UnitCount: nullableInt,
  spacingCode: nullableString,
  spacingDescription: nullableString,
  spacingBetweenRowsM: nullableNumber,
  spacingBetweenTreesM: nullableNumber,
  treeDensityPerHa: nullableNumber,
  survivalRate: nullableNumber,
  dominantHeightM: nullableNumber,
  meanHeightM: nullableNumber,
  quadraticDiameterM: nullableNumber,
  basalAreaM2: nullableNumber,
  unitVolumeM3NoBarkPerHa: nullableNumber,
  unitVolumeM3WithBarkPerHa: nullableNumber,
  totalVolumeM3NoBark: nullableNumber,
  totalVolumeM3WithBark: nullableNumber,
  adjustedVolumeM3NoBarkPerHa: nullableNumber,
  adjustedVolumeM3WithBarkPerHa: nullableNumber,
  imaClassCode: nullableString,
  imaClassName: nullableString,
  actualCostUsd: nullableNumber,
  isActive: z.coerce.boolean().optional(),
});

export const updateBiologicalAssetSchema = createBiologicalAssetSchema
  .omit({ level4Id: true })
  .partial()
  .extend({
    id: uuidSchema,
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "id"),
    "Debe proporcionar al menos un campo para actualizar",
  );

export const deleteBiologicalAssetSchema = z.object({
  id: uuidSchema,
});

export const getBiologicalAssetQuerySchema = z.object({
  level4Id: uuidSchema.optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["biologicalAssetKey", "accountingKey", "assetType", "plantingYear", "inventoryCode", "isActive", "createdAt"]).default("biologicalAssetKey"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
