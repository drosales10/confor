import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
    orderBy: { name: "asc" },
  });

  console.log("ORGANIZATIONS");
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
