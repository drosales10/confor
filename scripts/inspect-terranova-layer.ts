import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgSlug = "terranova-de-venezuela";

  const org = await prisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    throw new Error("No existe Terranova de Venezuela activa.");
  }

  const counts = await prisma.$queryRaw<Array<{ active_level4: number; active_geometry: number }>>`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM "public"."ForestPatrimonyLevel4" l4
        JOIN "public"."ForestPatrimonyLevel3" l3 ON l3.id = l4."level3Id"
        JOIN "public"."ForestPatrimonyLevel2" l2 ON l2.id = l3."level2Id"
        WHERE l4."isActive" = TRUE
          AND l2."organizationId" = ${org.id}::uuid
      ) AS active_level4,
      (
        SELECT COUNT(*)::int
        FROM public.forest_geometry_n4 g
        WHERE g.is_active = TRUE
          AND g.organization_id = ${org.id}::uuid
      ) AS active_geometry
  `;

  const latest = await prisma.$queryRaw<Array<{
    level4_id: string;
    code: string;
    name: string;
    updated_at: Date;
    superficie_ha: number;
    lon: number;
    lat: number;
  }>>`
    SELECT
      g.level4_id::text,
      l4.code,
      l4.name,
      g.updated_at,
      g.superficie_ha::double precision AS superficie_ha,
      ST_X(g.centroid) AS lon,
      ST_Y(g.centroid) AS lat
    FROM public.forest_geometry_n4 g
    JOIN "public"."ForestPatrimonyLevel4" l4 ON l4.id = g.level4_id
    WHERE g.organization_id = ${org.id}::uuid
      AND g.is_active = TRUE
    ORDER BY g.updated_at DESC
    LIMIT 5
  `;

  console.log("TERRANOVA_LAYER_CHECK");
  console.log(JSON.stringify({ org, counts: counts[0] ?? null, latest }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
