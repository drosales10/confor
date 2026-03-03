import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const code = "100101001";

  const counts = {
    level2: await prisma.forestPatrimonyLevel2.count(),
    level3: await prisma.forestPatrimonyLevel3.count(),
    level4: await prisma.forestPatrimonyLevel4.count(),
    geometry: await prisma.forestGeometryN4.count(),
  };

  const level4 = await prisma.$queryRawUnsafe(`
    SELECT
      l4.id::text AS id,
      l4.code,
      l4.name,
      l4."isActive" AS is_active,
      l4."level3Id"::text AS level3_id,
      l3."level2Id"::text AS level2_id,
      l2."organizationId"::text AS organization_id,
      l4."createdAt" AS created_at,
      l4."updatedAt" AS updated_at
    FROM "public"."ForestPatrimonyLevel4" l4
    JOIN "public"."ForestPatrimonyLevel3" l3 ON l3.id = l4."level3Id"
    JOIN "public"."ForestPatrimonyLevel2" l2 ON l2.id = l3."level2Id"
    WHERE l4.code = $1
    ORDER BY l4."updatedAt" DESC
  `, code);

  const geometry = await prisma.$queryRawUnsafe(`
    SELECT
      g.id::text,
      g.level4_id::text,
      g.organization_id::text,
      g.is_active,
      g.valid_from,
      g.valid_to,
      g.updated_at,
      g.superficie_ha::double precision AS superficie_ha,
      ST_IsValid(g.geom) AS is_valid,
      ST_GeometryType(g.geom) AS geom_type,
      ST_X(ST_Centroid(g.geom)) AS lon,
      ST_Y(ST_Centroid(g.geom)) AS lat,
      ST_Extent(g.geom) OVER ()::text AS extent
    FROM public.forest_geometry_n4 g
    JOIN "public"."ForestPatrimonyLevel4" l4 ON l4.id = g.level4_id
    WHERE l4.code = $1
    ORDER BY g.updated_at DESC
  `, code);

  const similarCodes = await prisma.$queryRawUnsafe(`
    SELECT
      l4.code,
      l4.name,
      l4."isActive" AS is_active,
      l4."updatedAt" AS updated_at
    FROM "public"."ForestPatrimonyLevel4" l4
    WHERE l4.code ILIKE $1
    ORDER BY l4."updatedAt" DESC
    LIMIT 30
  `, "%1001%");

  const allLevel4 = await prisma.$queryRawUnsafe(`
    SELECT
      l4.id::text,
      l4.code,
      l4.name,
      l4."isActive" AS is_active,
      l4."updatedAt" AS updated_at
    FROM "public"."ForestPatrimonyLevel4" l4
    ORDER BY l4."updatedAt" DESC
    LIMIT 50
  `);

  const allGeometry = await prisma.$queryRawUnsafe(`
    SELECT
      g.id::text,
      g.level4_id::text,
      g.organization_id::text,
      g.is_active,
      g.updated_at,
      g.superficie_ha::double precision AS superficie_ha,
      ST_X(ST_Centroid(g.geom)) AS lon,
      ST_Y(ST_Centroid(g.geom)) AS lat
    FROM public.forest_geometry_n4 g
    ORDER BY g.updated_at DESC
    LIMIT 50
  `);

  console.log("LEVEL4_ROWS");
  console.log(JSON.stringify(level4, null, 2));
  console.log("GEOMETRY_ROWS");
  console.log(JSON.stringify(geometry, null, 2));
  console.log("SIMILAR_CODES");
  console.log(JSON.stringify(similarCodes, null, 2));
  console.log("COUNTS");
  console.log(JSON.stringify(counts, null, 2));
  console.log("ALL_LEVEL4");
  console.log(JSON.stringify(allLevel4, null, 2));
  console.log("ALL_GEOMETRY");
  console.log(JSON.stringify(allGeometry, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
