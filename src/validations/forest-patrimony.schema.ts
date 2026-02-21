import { z } from "zod";
import { paginationSchema, uuidSchema } from "@/validations/common.schema";

const decimalField = z.coerce.number().nonnegative();
const optionalDecimalField = z.coerce.number().nonnegative().optional();

const level2Schema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(255),
  type: z.enum(["FINCA", "PREDIO", "HATO", "FUNDO", "HACIENDA"]),
  legalDocumentDate: z.coerce.date().optional(),
  legalStatus: z.enum(["ADQUISICION", "ARRIENDO", "USUFRUCTO", "COMODATO"]).optional(),
  totalAreaHa: decimalField,
  centroidLatitude: z.coerce.number().min(-90).max(90).optional(),
  centroidLongitude: z.coerce.number().min(-180).max(180).optional(),
  ownerRepresentative: z.string().max(255).optional(),
  publicRegistryNumber: z.string().max(120).optional(),
  publicRegistryDate: z.coerce.date().optional(),
  address: z.string().max(2000).optional(),
  lastInfoDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

const level3Schema = z.object({
  level2Id: uuidSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(255),
  type: z.enum(["COMPARTIMIENTO", "BLOCK", "SECCION", "LOTE", "ZONA", "BLOQUE"]),
  totalAreaHa: decimalField,
  centroidLatitude: z.coerce.number().min(-90).max(90).optional(),
  centroidLongitude: z.coerce.number().min(-180).max(180).optional(),
  lastInfoDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

const level4Schema = z.object({
  level3Id: uuidSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(255),
  type: z.enum(["RODAL", "PARCELA", "ENUMERATION", "UNIDAD_DE_MANEJO"]),
  totalAreaHa: decimalField,
  plantableAreaHa: optionalDecimalField,
  rotationPhase: z.string().max(120).optional(),
  previousUse: z.string().max(255).optional(),
  centroidLatitude: z.coerce.number().min(-90).max(90).optional(),
  centroidLongitude: z.coerce.number().min(-180).max(180).optional(),
  lastInfoDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

const level5Schema = z.object({
  level4Id: uuidSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(255),
  type: z.enum(["REFERENCIA", "SUBUNIDAD", "SUBPARCELA", "MUESTRA", "SUBMUESTRA"]),
  shapeType: z.enum(["RECTANGULAR", "CUADRADA", "CIRCULAR", "HEXAGONAL"]),
  dimension1M: optionalDecimalField,
  dimension2M: optionalDecimalField,
  dimension3M: optionalDecimalField,
  dimension4M: optionalDecimalField,
  centroidLatitude: z.coerce.number().min(-90).max(90).optional(),
  centroidLongitude: z.coerce.number().min(-180).max(180).optional(),
  lastInfoDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

const level2UpdateSchema = level2Schema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Se requiere al menos un campo a actualizar",
});

const level3UpdateSchema = level3Schema
  .omit({ level2Id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Se requiere al menos un campo a actualizar",
  });

const level4UpdateSchema = level4Schema
  .omit({ level3Id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Se requiere al menos un campo a actualizar",
  });

const level5UpdateSchema = level5Schema
  .omit({ level4Id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Se requiere al menos un campo a actualizar",
  });

export const createPatrimonySchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("2"), data: level2Schema }),
  z.object({ level: z.literal("3"), data: level3Schema }),
  z.object({ level: z.literal("4"), data: level4Schema }),
  z.object({ level: z.literal("5"), data: level5Schema }),
]);

export const getPatrimonyQuerySchema = paginationSchema.extend({
  level: z.enum(["2", "3", "4", "5"]),
  parentId: uuidSchema.optional(),
  search: z.string().optional(),
});

export const updatePatrimonySchema = z.discriminatedUnion("level", [
  z.object({
    level: z.literal("2"),
    id: uuidSchema,
    data: level2UpdateSchema,
  }),
  z.object({
    level: z.literal("3"),
    id: uuidSchema,
    data: level3UpdateSchema,
  }),
  z.object({
    level: z.literal("4"),
    id: uuidSchema,
    data: level4UpdateSchema,
  }),
  z.object({
    level: z.literal("5"),
    id: uuidSchema,
    data: level5UpdateSchema,
  }),
]);

export const deletePatrimonySchema = z.object({
  level: z.enum(["2", "3", "4", "5"]),
  id: uuidSchema,
});

export const updateNeighborSchema = z
  .object({
    id: uuidSchema,
    code: z.string().min(1).max(80).optional(),
    name: z.string().min(2).max(255).optional(),
    type: z.string().min(2).max(80).optional(),
  })
  .refine((value) => value.code !== undefined || value.name !== undefined || value.type !== undefined, {
    message: "Se requiere al menos un campo a actualizar",
  });

export const deleteNeighborSchema = z.object({
  id: uuidSchema,
});
