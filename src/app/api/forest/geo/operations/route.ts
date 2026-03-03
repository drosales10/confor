import { type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";

type SplitPayload = {
  operation: "split";
  sourceLevel4Id: string;
  newCodes: [string, string];
  cutGeometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
};

type MergePayload = {
  operation: "merge";
  sourceLevel4Ids: [string, string];
  newCode: string;
};

type OperationPayload = SplitPayload | MergePayload;

async function resolveOrganizationId(sessionUser: { id?: string; organizationId?: string | null }) {
  if (sessionUser.organizationId !== undefined) {
    return sessionUser.organizationId;
  }

  if (!sessionUser.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { organizationId: true },
  });

  return user?.organizationId ?? null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSplitPayload(value: unknown): value is SplitPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (payload.operation !== "split") return false;

  const sourceLevel4Id = payload.sourceLevel4Id;
  const newCodes = payload.newCodes;
  const cutGeometry = payload.cutGeometry as Record<string, unknown> | undefined;

  if (typeof sourceLevel4Id !== "string" || !isUuid(sourceLevel4Id)) return false;
  if (!Array.isArray(newCodes) || newCodes.length !== 2 || newCodes.some((item) => typeof item !== "string" || !item.trim())) return false;

  if (!cutGeometry || (cutGeometry.type !== "Polygon" && cutGeometry.type !== "MultiPolygon")) return false;
  if (cutGeometry.coordinates === undefined) return false;

  return true;
}

function isMergePayload(value: unknown): value is MergePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (payload.operation !== "merge") return false;

  const sourceLevel4Ids = payload.sourceLevel4Ids;
  const newCode = payload.newCode;

  if (!Array.isArray(sourceLevel4Ids) || sourceLevel4Ids.length !== 2) return false;
  if (sourceLevel4Ids.some((item) => typeof item !== "string" || !isUuid(item))) return false;
  if (typeof newCode !== "string" || !newCode.trim()) return false;

  return true;
}

async function syncLevel4Metrics(tx: Prisma.TransactionClient, organizationId: string, level4Id: string) {
  const metrics = await tx.$queryRaw<Array<{ superficie_ha: number; lat: number | null; lon: number | null }>>`
    SELECT
      superficie_ha::double precision AS superficie_ha,
      ST_Y(centroid) AS lat,
      ST_X(centroid) AS lon
    FROM public.forest_geometry_n4
    WHERE organization_id = ${organizationId}::uuid
      AND level4_id = ${level4Id}::uuid
      AND is_active = TRUE
    ORDER BY valid_from DESC
    LIMIT 1
  `;

  const metric = metrics.at(0);
  if (!metric) return;

  await tx.forestPatrimonyLevel4.update({
    where: { id: level4Id },
    data: {
      totalAreaHa: metric.superficie_ha,
      centroidLatitude: metric.lat,
      centroidLongitude: metric.lon,
    },
  });
}

function mapOperationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("Ya existe un rodal con ese código en el mismo Nivel 3", 409);
    }
  }

  const message = error instanceof Error ? error.message : "No fue posible ejecutar la operación geoespacial";
  return fail(message, 400);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "UPDATE");
    if (permissionError) return permissionError;

    const canUpdate = hasPermission(authResult.session.user.permissions ?? [], "forest-patrimony", "UPDATE");
    if (!canUpdate) {
      return fail("No autorizado para modificar geometrías de patrimonio", 403);
    }
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const body = (await req.json()) as OperationPayload;

  if (!isSplitPayload(body) && !isMergePayload(body)) {
    return fail("Payload inválido para operación geoespacial", 400);
  }

  const effectiveOrganizationId = organizationId ?? undefined;

  try {
    if (isSplitPayload(body)) {
      const source = await prisma.forestPatrimonyLevel4.findFirst({
        where: {
          id: body.sourceLevel4Id,
          isActive: true,
          ...(!isSuperAdmin ? { level3: { level2: { organizationId: effectiveOrganizationId } } } : {}),
        },
        include: {
          level3: {
            include: {
              level2: true,
            },
          },
        },
      });

      if (!source) {
        return fail("Rodal origen no encontrado o sin permisos", 404);
      }

      const activeOrganizationId = source.level3.level2.organizationId;
      if (!activeOrganizationId) {
        return fail("No se pudo determinar la organización del rodal origen", 400);
      }

      const cutGeometryJson = JSON.stringify(body.cutGeometry);

      const result = await prisma.$transaction(async (tx) => {
        const parts = await tx.$queryRaw<Array<{ part_a: Prisma.JsonValue | null; part_b: Prisma.JsonValue | null }>>`
          WITH source_geom AS (
            SELECT geom
            FROM public.forest_geometry_n4
            WHERE organization_id = ${activeOrganizationId}::uuid
              AND level4_id = ${source.id}::uuid
              AND is_active = TRUE
            ORDER BY valid_from DESC
            LIMIT 1
          ),
          cut_geom AS (
            SELECT ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${cutGeometryJson})), 4326) AS geom
          )
          SELECT
            ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_Intersection(source_geom.geom, cut_geom.geom), 3)))::json AS part_a,
            ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_Difference(source_geom.geom, cut_geom.geom), 3)))::json AS part_b
          FROM source_geom, cut_geom
        `;

        const part = parts.at(0);
        const partA = part?.part_a;
        const partB = part?.part_b;
        if (!partA || !partB) {
          throw new Error("No fue posible partir la geometría. Dibuja una zona de corte que divida el rodal en dos partes válidas.");
        }

        await tx.$executeRaw`
          UPDATE public.forest_geometry_n4
          SET is_active = FALSE,
              valid_to = NOW(),
              updated_at = NOW()
          WHERE organization_id = ${activeOrganizationId}::uuid
            AND level4_id = ${source.id}::uuid
            AND is_active = TRUE
        `;

        await tx.forestPatrimonyLevel4.update({
          where: { id: source.id },
          data: { isActive: false },
        });

        const [codeA, codeB] = body.newCodes.map((item) => item.trim());

        const createdA = await tx.forestPatrimonyLevel4.create({
          data: {
            level3Id: source.level3Id,
            code: codeA,
            name: `${source.name} - A`,
            type: source.type,
            fscCertificateStatus: source.fscCertificateStatus,
            totalAreaHa: 0,
            plantableAreaHa: source.plantableAreaHa,
            rotationPhase: source.rotationPhase,
            previousUse: source.previousUse,
            lastInfoDate: new Date(),
            isActive: true,
          },
        });

        const createdB = await tx.forestPatrimonyLevel4.create({
          data: {
            level3Id: source.level3Id,
            code: codeB,
            name: `${source.name} - B`,
            type: source.type,
            fscCertificateStatus: source.fscCertificateStatus,
            totalAreaHa: 0,
            plantableAreaHa: source.plantableAreaHa,
            rotationPhase: source.rotationPhase,
            previousUse: source.previousUse,
            lastInfoDate: new Date(),
            isActive: true,
          },
        });

        const partAJson = JSON.stringify(partA);
        const partBJson = JSON.stringify(partB);

        await tx.$executeRaw`
          INSERT INTO public.forest_geometry_n4 (
            id,
            organization_id,
            level2_id,
            level3_id,
            level4_id,
            geom,
            is_active,
            valid_from,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${activeOrganizationId}::uuid,
            ${source.level3.level2Id}::uuid,
            ${source.level3Id}::uuid,
            ${createdA.id}::uuid,
            ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${partAJson})), 4326),
            TRUE,
            NOW(),
            NOW(),
            NOW()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO public.forest_geometry_n4 (
            id,
            organization_id,
            level2_id,
            level3_id,
            level4_id,
            geom,
            is_active,
            valid_from,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${activeOrganizationId}::uuid,
            ${source.level3.level2Id}::uuid,
            ${source.level3Id}::uuid,
            ${createdB.id}::uuid,
            ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${partBJson})), 4326),
            TRUE,
            NOW(),
            NOW(),
            NOW()
          )
        `;

        await syncLevel4Metrics(tx, activeOrganizationId, createdA.id);
        await syncLevel4Metrics(tx, activeOrganizationId, createdB.id);

        return {
          sourceLevel4Id: source.id,
          createdLevel4Ids: [createdA.id, createdB.id],
        };
      });

      return ok({
        operation: "split",
        ...result,
      });
    }

    const [firstId, secondId] = body.sourceLevel4Ids;

    const sources = await prisma.forestPatrimonyLevel4.findMany({
      where: {
        id: { in: [firstId, secondId] },
        isActive: true,
        ...(!isSuperAdmin ? { level3: { level2: { organizationId: effectiveOrganizationId } } } : {}),
      },
      include: {
        level3: {
          include: {
            level2: true,
          },
        },
      },
    });

    if (sources.length !== 2) {
      return fail("Debe seleccionar exactamente 2 rodales válidos para consolidar", 400);
    }

    const [sourceA, sourceB] = sources;
    if (sourceA.level3Id !== sourceB.level3Id) {
      return fail("Solo se pueden consolidar rodales del mismo Nivel 3", 400);
    }

    const activeOrganizationId = sourceA.level3.level2.organizationId;
    if (!activeOrganizationId) {
      return fail("No se pudo determinar la organización de los rodales", 400);
    }

    const mergeResult = await prisma.$transaction(async (tx) => {
      const mergedRows = await tx.$queryRaw<Array<{ merged: Prisma.JsonValue | null }>>`
        SELECT ST_AsGeoJSON(ST_Multi(ST_UnaryUnion(ST_Collect(geom))))::json AS merged
        FROM public.forest_geometry_n4
        WHERE organization_id = ${activeOrganizationId}::uuid
          AND is_active = TRUE
          AND level4_id IN (${sourceA.id}::uuid, ${sourceB.id}::uuid)
      `;

      const mergedGeometry = mergedRows.at(0)?.merged;
      if (!mergedGeometry) {
        throw new Error("No fue posible consolidar las geometrías seleccionadas");
      }

      await tx.$executeRaw`
        UPDATE public.forest_geometry_n4
        SET is_active = FALSE,
            valid_to = NOW(),
            updated_at = NOW()
        WHERE organization_id = ${activeOrganizationId}::uuid
          AND level4_id IN (${sourceA.id}::uuid, ${sourceB.id}::uuid)
          AND is_active = TRUE
      `;

      await tx.forestPatrimonyLevel4.updateMany({
        where: { id: { in: [sourceA.id, sourceB.id] } },
        data: { isActive: false },
      });

      const newCode = body.newCode.trim();

      const created = await tx.forestPatrimonyLevel4.create({
        data: {
          level3Id: sourceA.level3Id,
          code: newCode,
          name: `${sourceA.name} + ${sourceB.name}`,
          type: sourceA.type,
          fscCertificateStatus: sourceA.fscCertificateStatus,
          totalAreaHa: 0,
          plantableAreaHa: sourceA.plantableAreaHa,
          rotationPhase: sourceA.rotationPhase,
          previousUse: sourceA.previousUse,
          lastInfoDate: new Date(),
          isActive: true,
        },
      });

      const mergedGeometryJson = JSON.stringify(mergedGeometry);

      await tx.$executeRaw`
        INSERT INTO public.forest_geometry_n4 (
          id,
          organization_id,
          level2_id,
          level3_id,
          level4_id,
          geom,
          is_active,
          valid_from,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          ${activeOrganizationId}::uuid,
          ${sourceA.level3.level2Id}::uuid,
          ${sourceA.level3Id}::uuid,
          ${created.id}::uuid,
          ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${mergedGeometryJson})), 4326),
          TRUE,
          NOW(),
          NOW(),
          NOW()
        )
      `;

      await syncLevel4Metrics(tx, activeOrganizationId, created.id);

      return {
        sourceLevel4Ids: [sourceA.id, sourceB.id],
        createdLevel4Id: created.id,
      };
    });

    return ok({
      operation: "merge",
      ...mergeResult,
    });
  } catch (error) {
    return mapOperationError(error);
  }
}
