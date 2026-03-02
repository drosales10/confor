import { z } from "zod";
import { paginationSchema, uuidSchema } from "@/validations/common.schema";

const nullableString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    return value.length > 0 ? value : null;
  });

const nullableNumber = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim().replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, z.number().nullable())
  .optional();

const requiredNumber = z.preprocess((value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}, z.number());

export const managementSchemeCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(255),
  isActive: z.coerce.boolean().optional(),
});

export const managementSchemeUpdateSchema = managementSchemeCreateSchema.partial().extend({
  id: uuidSchema,
});

export const inventoryTypeCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(255),
  isActive: z.coerce.boolean().optional(),
});

export const inventoryTypeUpdateSchema = inventoryTypeCreateSchema.partial().extend({
  id: uuidSchema,
});

export const imaClassCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  classification: z.enum(["I", "II", "III", "IV", "V"]),
  name: z.string().trim().min(1).max(120),
  description: nullableString,
  rangeMin: nullableNumber,
  rangeMax: nullableNumber,
  isActive: z.coerce.boolean().optional(),
});

export const imaClassUpdateSchema = imaClassCreateSchema.partial().extend({
  id: uuidSchema,
});

export const speciesCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  scientificName: z.string().trim().min(1).max(255),
  commonName: nullableString,
  genus: nullableString,
  family: nullableString,
  taxonomicOrder: nullableString,
  isActive: z.coerce.boolean().optional(),
});

export const speciesUpdateSchema = speciesCreateSchema.partial().extend({
  id: uuidSchema,
});

export const provenanceCreateSchema = z.object({
  countryId: uuidSchema,
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(150),
  isActive: z.coerce.boolean().optional(),
});

export const provenanceUpdateSchema = provenanceCreateSchema.partial().extend({
  id: uuidSchema,
});

export const vegetalMaterialCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(255),
  speciesId: uuidSchema,
  materialType: z.enum(["PURA", "HIBRIDA"]),
  plantType: z.enum(["PROGENIE", "CLON", "INJERTO", "IN_VITRO"]),
  plantOrigin: z.enum(["NATIVA", "EXOTICA", "NATURALIZADA", "INTRODUCIDA", "ENDEMICA", "CULTIVADA"]),
  provenanceId: uuidSchema.optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export const vegetalMaterialUpdateSchema = vegetalMaterialCreateSchema.partial().extend({
  id: uuidSchema,
});

export const continentCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const continentUpdateSchema = continentCreateSchema.partial().extend({
  id: uuidSchema,
});

export const countryCreateSchema = z.object({
  continentId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const countryUpdateSchema = countryCreateSchema.partial().extend({
  id: uuidSchema,
});

const landUseCategoryValues = [
  "BOSQUE",
  "NO BOSQUE",
  "BOSQUE DEFORESTADO",
  "BOSQUE DEGRADADO",
  "CUERPOS DE AGUA",
  "SUELO DESNUDO",
  "INFRAESTRUCTURA",
] as const;

export const landUseTypeCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(150),
  category: z.enum(landUseCategoryValues),
  isProductive: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const landUseTypeUpdateSchema = landUseTypeCreateSchema.partial().extend({
  id: uuidSchema,
});

export const regionCreateSchema = z.object({
  countryId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const regionUpdateSchema = regionCreateSchema.partial().extend({
  id: uuidSchema,
});

export const stateDepartmentCreateSchema = z.object({
  countryId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const stateDepartmentUpdateSchema = stateDepartmentCreateSchema.partial().extend({
  id: uuidSchema,
});

export const municipalityDistrictCreateSchema = z.object({
  stateId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const municipalityDistrictUpdateSchema = municipalityDistrictCreateSchema.partial().extend({
  id: uuidSchema,
});

export const cityCreateSchema = z.object({
  municipalityId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  isActive: z.coerce.boolean().optional(),
});

export const cityUpdateSchema = cityCreateSchema.partial().extend({
  id: uuidSchema,
});

export const communityTerritoryCreateSchema = z.object({
  cityId: uuidSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(150),
  type: z.enum(["COMUNA", "TERRITORIO_INDIGENA", "COMUNIDAD_CRIOLLA", "PARROQUIA"]),
  isActive: z.coerce.boolean().optional(),
});

export const communityTerritoryUpdateSchema = communityTerritoryCreateSchema.partial().extend({
  id: uuidSchema,
});

export const spacingCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(150),
  description: nullableString,
  betweenRowsM: nullableNumber,
  betweenTreesM: nullableNumber,
  treeDensityPerHa: nullableNumber,
  isActive: z.coerce.boolean().optional(),
});

export const spacingUpdateSchema = spacingCreateSchema.partial().extend({
  id: uuidSchema,
});

export const level4AdministrativeCostCreateSchema = z.object({
  level4Id: uuidSchema,
  code: z.string().trim().min(1).max(80),
  plantationAreaHa: requiredNumber,
  rotationPhase: nullableString,
  accountingDocumentId: uuidSchema.optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export const level4AdministrativeCostUpdateSchema = level4AdministrativeCostCreateSchema.partial().extend({
  id: uuidSchema,
});

export const productTypeCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(150),
  minLengthM: nullableNumber,
  maxLengthM: nullableNumber,
  minSmallEndDiameterCm: nullableNumber,
  maxSmallEndDiameterCm: nullableNumber,
  recommendedHarvestType: z.enum(["MECANIZADA", "MANUAL"]),
  isActive: z.coerce.boolean().optional(),
});

export const productTypeUpdateSchema = productTypeCreateSchema.partial().extend({
  id: uuidSchema,
});

export const forestConfigQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
});

export const deleteByIdSchema = z.object({
  id: uuidSchema,
});
