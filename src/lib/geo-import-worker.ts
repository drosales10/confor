import { GeoImportJobStatus, GeoImportItemStatus, GeoRecalcJobStatus, Prisma } from "@prisma/client";
import JSZip from "jszip";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";

type GeoFeature = {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: Record<string, unknown> | null;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

async function parseShapefile(zipBuffer: Buffer): Promise<unknown> {
  if (!(globalThis as { self?: unknown }).self) {
    (globalThis as { self?: unknown }).self = globalThis;
  }

  const module = await import("shpjs");
  const shp = module.default as (input: ArrayBuffer | Uint8Array | Buffer) => Promise<unknown>;
  return shp(zipBuffer);
}

const DEFAULT_FIELD_MAP = {
  level2: ["nivel2", "nivel_2", "cod_n2", "codfinca", "finca", "nivel2_id", "n2"],
  level3: ["nivel3", "nivel_3", "cod_n3", "codlote", "lote", "nivel3_id", "n3"],
  level4: ["nivel4", "nivel_4", "cod_n4", "codrodal", "rodal", "nivel4_id", "n4"],
};

function normalizePropertyMap(properties: Record<string, unknown> | null): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (!properties) return map;

  for (const [key, value] of Object.entries(properties)) {
    map.set(key.toLowerCase(), value);
  }

  return map;
}

function pickStringValue(properties: Record<string, unknown> | null, candidates: string[]): string | null {
  const normalized = normalizePropertyMap(properties);
  for (const candidate of candidates) {
    const value = normalized.get(candidate.toLowerCase());
    if (value === undefined || value === null) continue;
    const parsed = String(value).trim();
    if (parsed) return parsed;
  }
  return null;
}

function normalizeCollection(raw: unknown): FeatureCollection {
  if (!raw) return { type: "FeatureCollection", features: [] };

  if (Array.isArray(raw)) {
    const first = raw.find((item) => typeof item === "object" && item !== null) as FeatureCollection | undefined;
    if (first?.type === "FeatureCollection" && Array.isArray(first.features)) {
      return first;
    }
    return { type: "FeatureCollection", features: [] };
  }

  const maybeCollection = raw as FeatureCollection;
  if (maybeCollection?.type === "FeatureCollection" && Array.isArray(maybeCollection.features)) {
    return maybeCollection;
  }

  return { type: "FeatureCollection", features: [] };
}

function normalizeGeometry(geometry: GeoFeature["geometry"]): { type: "MultiPolygon"; coordinates: unknown } | null {
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [geometry.coordinates],
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates,
    };
  }

  return null;
}

async function setJobStatus(
  jobId: string,
  status: GeoImportJobStatus,
  data?: Pick<Prisma.GeoImportJobUpdateInput, "errorMessage" | "startedAt" | "completedAt" | "totalRecords" | "processedRecords" | "failedRecords">,
) {
  await prisma.geoImportJob.update({
    where: { id: jobId },
    data: {
      status,
      ...(data ?? {}),
    },
  });
}

async function appendItem(params: {
  jobId: string;
  featureIndex: number;
  status: GeoImportItemStatus;
  level2Code?: string | null;
  level3Code?: string | null;
  level4Code?: string | null;
  message?: string;
  rawProperties?: Record<string, unknown> | null;
}) {
  await prisma.geoImportJobItem.create({
    data: {
      jobId: params.jobId,
      featureIndex: params.featureIndex,
      status: params.status,
      level2Code: params.level2Code ?? null,
      level3Code: params.level3Code ?? null,
      level4Code: params.level4Code ?? null,
      message: params.message,
      rawProperties: params.rawProperties
        ? (params.rawProperties as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

export async function processGeoImportJob(jobId: string) {
  const job = await prisma.geoImportJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return { processed: false, reason: "job_not_found" as const };
  }

  if (job.status === GeoImportJobStatus.PROCESSING) {
    return { processed: false, reason: "already_processing" as const };
  }

  await setJobStatus(jobId, GeoImportJobStatus.EXTRACTING, {
    startedAt: new Date(),
    errorMessage: null,
    processedRecords: 0,
    failedRecords: 0,
  });

  try {
    const zipBuffer = await fs.readFile(job.storagePath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const fileNames = Object.keys(zip.files).map((name) => name.toLowerCase());

    const requiredExtensions = [".shp", ".shx", ".dbf", ".prj"];
    const missing = requiredExtensions.filter((ext) => !fileNames.some((name) => name.endsWith(ext)));

    if (missing.length > 0) {
      throw new Error(`Archivo ZIP inválido. Faltan: ${missing.join(", ")}`);
    }

    await setJobStatus(jobId, GeoImportJobStatus.VALIDATING);

    const geoRaw = await parseShapefile(zipBuffer);
    const collection = normalizeCollection(geoRaw);

    if (collection.features.length === 0) {
      throw new Error("No se encontraron entidades geográficas en el archivo");
    }

    await setJobStatus(jobId, GeoImportJobStatus.PROCESSING, {
      totalRecords: collection.features.length,
    });

    let processedRecords = 0;
    let failedRecords = 0;

    for (let index = 0; index < collection.features.length; index += 1) {
      const feature = collection.features[index];
      const level2Code = pickStringValue(feature.properties, DEFAULT_FIELD_MAP.level2);
      const level3Code = pickStringValue(feature.properties, DEFAULT_FIELD_MAP.level3);
      const level4Code = pickStringValue(feature.properties, DEFAULT_FIELD_MAP.level4);

      if (!level2Code || !level3Code || !level4Code) {
        failedRecords += 1;
        await appendItem({
          jobId,
          featureIndex: index,
          status: GeoImportItemStatus.FAILED,
          level2Code,
          level3Code,
          level4Code,
          message: "No se encontraron códigos de jerarquía Nivel2/Nivel3/Nivel4 en las propiedades.",
          rawProperties: feature.properties,
        });
        continue;
      }

      const geometry = normalizeGeometry(feature.geometry);
      if (!geometry) {
        failedRecords += 1;
        await appendItem({
          jobId,
          featureIndex: index,
          status: GeoImportItemStatus.FAILED,
          level2Code,
          level3Code,
          level4Code,
          message: "Solo se permiten geometrías Polygon o MultiPolygon.",
          rawProperties: feature.properties,
        });
        continue;
      }

      const level4 = await prisma.forestPatrimonyLevel4.findFirst({
        where: {
          code: level4Code,
          level3: {
            code: level3Code,
            level2: {
              code: level2Code,
              organizationId: job.organizationId,
            },
          },
        },
        include: {
          level3: {
            include: {
              level2: true,
            },
          },
        },
      });

      if (!level4) {
        failedRecords += 1;
        await appendItem({
          jobId,
          featureIndex: index,
          status: GeoImportItemStatus.FAILED,
          level2Code,
          level3Code,
          level4Code,
          message: "No existe relación jerárquica válida para Nivel 2/3/4 en la organización.",
          rawProperties: feature.properties,
        });
        continue;
      }

      const geometryJson = JSON.stringify(geometry);

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE public.forest_geometry_n4
            SET is_active = FALSE,
                valid_to = NOW(),
                updated_at = NOW()
            WHERE organization_id = ${job.organizationId}::uuid
              AND level4_id = ${level4.id}::uuid
              AND is_active = TRUE
          `;

          await tx.$executeRaw`
            INSERT INTO public.forest_geometry_n4 (
              id,
              organization_id,
              level2_id,
              level3_id,
              level4_id,
              geom,
              import_job_id,
              is_active,
              valid_from,
              created_at,
              updated_at
            ) VALUES (
              gen_random_uuid(),
              ${job.organizationId}::uuid,
              ${level4.level3.level2Id}::uuid,
              ${level4.level3Id}::uuid,
              ${level4.id}::uuid,
              ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${geometryJson})), 4326),
              ${jobId}::uuid,
              TRUE,
              NOW(),
              NOW(),
              NOW()
            )
          `;

          const metrics = await tx.$queryRaw<Array<{ superficie_ha: number; lat: number | null; lon: number | null }>>`
            SELECT
              superficie_ha::double precision AS superficie_ha,
              ST_Y(centroid) AS lat,
              ST_X(centroid) AS lon
            FROM public.forest_geometry_n4
            WHERE organization_id = ${job.organizationId}::uuid
              AND level4_id = ${level4.id}::uuid
              AND is_active = TRUE
            ORDER BY valid_from DESC
            LIMIT 1
          `;

          const metric = metrics.at(0);
          if (metric) {
            await tx.forestPatrimonyLevel4.update({
              where: { id: level4.id },
              data: {
                totalAreaHa: metric.superficie_ha,
                centroidLatitude: metric.lat,
                centroidLongitude: metric.lon,
              },
            });
          }
        });

        processedRecords += 1;

        await appendItem({
          jobId,
          featureIndex: index,
          status: GeoImportItemStatus.PROCESSED,
          level2Code,
          level3Code,
          level4Code,
          rawProperties: feature.properties,
        });
      } catch (error) {
        failedRecords += 1;

        await appendItem({
          jobId,
          featureIndex: index,
          status: GeoImportItemStatus.FAILED,
          level2Code,
          level3Code,
          level4Code,
          message: error instanceof Error ? error.message : "Error procesando geometría",
          rawProperties: feature.properties,
        });
      }
    }

    await setJobStatus(jobId, GeoImportJobStatus.COMPLETED, {
      completedAt: new Date(),
      processedRecords,
      failedRecords,
    });

    return {
      processed: true,
      status: GeoImportJobStatus.COMPLETED,
      processedRecords,
      failedRecords,
      totalRecords: collection.features.length,
    };
  } catch (error) {
    await setJobStatus(jobId, GeoImportJobStatus.FAILED, {
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "Fallo en worker de importación",
    });

    return {
      processed: true,
      status: GeoImportJobStatus.FAILED,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function processNextPendingImportJob() {
  const nextJob = await prisma.geoImportJob.findFirst({
    where: { status: GeoImportJobStatus.PENDING },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!nextJob) {
    return { processed: false, reason: "no_pending_jobs" as const };
  }

  return processGeoImportJob(nextJob.id);
}

export async function enqueueLevel4RecalcJob(params: {
  organizationId: string;
  level4Id: string;
  createdById?: string | null;
}) {
  await prisma.forestGeometryRecalcJob.create({
    data: {
      organizationId: params.organizationId,
      level4Id: params.level4Id,
      status: GeoRecalcJobStatus.PENDING,
      createdById: params.createdById ?? null,
    },
  });
}

export async function processNextRecalcJob() {
  const job = await prisma.forestGeometryRecalcJob.findFirst({
    where: {
      status: GeoRecalcJobStatus.PENDING,
      runAfter: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!job) {
    return { processed: false, reason: "no_pending_recalc_jobs" as const };
  }

  await prisma.forestGeometryRecalcJob.update({
    where: { id: job.id },
    data: {
      status: GeoRecalcJobStatus.PROCESSING,
      startedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  try {
    const metrics = await prisma.$queryRaw<Array<{ superficie_ha: number; lat: number | null; lon: number | null }>>`
      SELECT
        superficie_ha::double precision AS superficie_ha,
        ST_Y(centroid) AS lat,
        ST_X(centroid) AS lon
      FROM public.forest_geometry_n4
      WHERE organization_id = ${job.organizationId}::uuid
        AND level4_id = ${job.level4Id}::uuid
        AND is_active = TRUE
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    const metric = metrics.at(0);
    if (!metric) {
      await prisma.forestGeometryRecalcJob.update({
        where: { id: job.id },
        data: {
          status: GeoRecalcJobStatus.FAILED,
          completedAt: new Date(),
          lastError: "No existe geometría activa para recalcular superficie",
        },
      });
      return { processed: true, status: GeoRecalcJobStatus.FAILED };
    }

    await prisma.$transaction([
      prisma.forestPatrimonyLevel4.update({
        where: { id: job.level4Id },
        data: {
          totalAreaHa: metric.superficie_ha,
          centroidLatitude: metric.lat,
          centroidLongitude: metric.lon,
        },
      }),
      prisma.forestGeometryRecalcJob.update({
        where: { id: job.id },
        data: {
          status: GeoRecalcJobStatus.COMPLETED,
          completedAt: new Date(),
        },
      }),
    ]);

    return { processed: true, status: GeoRecalcJobStatus.COMPLETED };
  } catch (error) {
    await prisma.forestGeometryRecalcJob.update({
      where: { id: job.id },
      data: {
        status: GeoRecalcJobStatus.FAILED,
        completedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Fallo en recálculo",
      },
    });

    return { processed: true, status: GeoRecalcJobStatus.FAILED };
  }
}
