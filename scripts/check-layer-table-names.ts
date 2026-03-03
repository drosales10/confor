import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{
    forest_patrimony_level2: string | null;
    forest_patrimony_level3: string | null;
    forest_patrimony_level4: string | null;
    forestgeometry2: string | null;
    forestgeometry3: string | null;
    forestgeometry4: string | null;
    forest_geometry_n4: string | null;
  }>>`
    SELECT
      to_regclass('public.forest_patrimony_level2')::text AS forest_patrimony_level2,
      to_regclass('public.forest_patrimony_level3')::text AS forest_patrimony_level3,
      to_regclass('public.forest_patrimony_level4')::text AS forest_patrimony_level4,
      to_regclass('public."ForestPatrimonyLevel2"')::text AS forestgeometry2,
      to_regclass('public."ForestPatrimonyLevel3"')::text AS forestgeometry3,
      to_regclass('public."ForestPatrimonyLevel4"')::text AS forestgeometry4,
      to_regclass('public.forest_geometry_n4')::text AS forest_geometry_n4
  `;

  console.log("TABLE_NAME_CHECK");
  console.log(JSON.stringify(rows[0] ?? null, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
