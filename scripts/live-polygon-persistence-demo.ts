import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RingPoint = [number, number];

function closeRing(points: RingPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return points;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...points, first];
  }
  return points;
}

async function main() {
  const targetOrgSlug = process.env.ORG_SLUG?.trim() || "terranova-de-venezuela";
  const targetOrgName = process.env.ORG_NAME?.trim() || "Terranova de Venezuela";

  const organization = await prisma.organization.findFirst({
    where: {
      isActive: true,
      OR: [
        { slug: targetOrgSlug },
        { name: targetOrgName },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) {
    throw new Error(`No se encontró organización objetivo (${targetOrgSlug} / ${targetOrgName}).`);
  }

  const level3 = await prisma.forestPatrimonyLevel3.findFirst({
    where: {
      isActive: true,
      level2: {
        isActive: true,
        organizationId: organization.id,
      },
    },
    include: {
      level2: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!level3 || !level3.level2.organizationId) {
    throw new Error(`No hay Nivel 3 activo para la organización ${organization.name}.`);
  }

  const organizationId = level3.level2.organizationId;
  const landUse = await prisma.landUseType.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  if (!landUse) {
    throw new Error("No hay usos de suelo activos para la organización del Nivel 3.");
  }

  const code = `LIVE-${Date.now()}`;
  const name = `Rodal Demo ${new Date().toISOString()}`;

  const baseLng = -62.7692;
  const baseLat = 8.6945;
  const ring = closeRing([
    [baseLng, baseLat],
    [baseLng + 0.002, baseLat],
    [baseLng + 0.002, baseLat + 0.002],
    [baseLng, baseLat + 0.002],
  ]);

  const geometryJson = JSON.stringify({
    type: "Polygon",
    coordinates: [ring],
  });

  const result = await prisma.$transaction(async (tx) => {
    const level4 = await tx.forestPatrimonyLevel4.create({
      data: {
        level3Id: level3.id,
        code,
        name,
        type: "RODAL",
        fscCertificateStatus: "NO",
        currentLandUseName: landUse.name,
        previousLandUseName: null,
        totalAreaHa: 0,
        rotationPhase: null,
        previousUse: null,
        isActive: true,
        lastInfoDate: new Date(),
      },
    });

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
        ${organizationId}::uuid,
        ${level3.level2Id}::uuid,
        ${level3.id}::uuid,
        ${level4.id}::uuid,
        ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${geometryJson})), 4326),
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
      WHERE organization_id = ${organizationId}::uuid
        AND level4_id = ${level4.id}::uuid
        AND is_active = TRUE
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    const metric = metrics.at(0);

    await tx.forestPatrimonyLevel4.update({
      where: { id: level4.id },
      data: {
        totalAreaHa: metric?.superficie_ha ?? 0,
        centroidLatitude: metric?.lat ?? null,
        centroidLongitude: metric?.lon ?? null,
      },
    });

    const layerRows = await tx.$queryRaw<Array<{
      id: string;
      level4_id: string;
      code: string;
      name: string;
      area_ha: number;
      centroid_lat: number | null;
      centroid_lon: number | null;
      geometry_type: string;
      coordinates_count: number;
    }>>`
      SELECT
        g.id,
        g.level4_id,
        p4.code,
        p4.name,
        g.superficie_ha::double precision AS area_ha,
        ST_Y(g.centroid) AS centroid_lat,
        ST_X(g.centroid) AS centroid_lon,
        ST_GeometryType(g.geom) AS geometry_type,
        ST_NPoints(g.geom) AS coordinates_count
      FROM public.forest_geometry_n4 g
      JOIN "public"."ForestPatrimonyLevel4" p4 ON p4.id = g.level4_id
      WHERE g.level4_id = ${level4.id}::uuid
        AND g.is_active = TRUE
      ORDER BY g.valid_from DESC
      LIMIT 1
    `;

    return {
      organizationName: organization.name,
      organizationSlug: organization.slug,
      level4Id: level4.id,
      level3Id: level3.id,
      level2Id: level3.level2Id,
      organizationId,
      code,
      name,
      landUse: landUse.name,
      metric: metric ?? null,
      layerReadback: layerRows.at(0) ?? null,
    };
  });

  console.log("LIVE_PERSISTENCE_RESULT");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("LIVE_PERSISTENCE_ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
