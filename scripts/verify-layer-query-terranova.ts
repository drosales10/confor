import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgId = "21641501-1992-4a44-9366-00e67f5a4322";
  const minLon = -180;
  const minLat = -85;
  const maxLon = 180;
  const maxLat = 85;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    level4_id: string;
    level4_code: string;
    level4_name: string;
    superficie_ha: number;
  }>>`
    SELECT
      g.id::text,
      g.level4_id::text,
      l4.code::text AS level4_code,
      l4.name::text AS level4_name,
      g.superficie_ha::double precision
    FROM public.forest_geometry_n4 g
    INNER JOIN "public"."ForestPatrimonyLevel2" l2 ON l2.id = g.level2_id
    INNER JOIN "public"."ForestPatrimonyLevel3" l3 ON l3.id = g.level3_id
    INNER JOIN "public"."ForestPatrimonyLevel4" l4 ON l4.id = g.level4_id
    WHERE g.is_active = TRUE
      AND g.organization_id = ${orgId}::uuid
      AND g.geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
    ORDER BY g.updated_at DESC, g.valid_from DESC
  `;

  console.log("VERIFY_LAYER_QUERY_TERRANOVA");
  console.log(JSON.stringify({ count: rows.length, sample: rows.slice(0, 5) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
