import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function nextMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
  return { start, end };
}

async function main() {
  const { start, end } = nextMonthRange();
  const tableName = `audit_logs_${start.getUTCFullYear()}_${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${tableName}
    PARTITION OF audit_logs
    FOR VALUES FROM ('${start.toISOString().slice(0, 10)}') TO ('${end.toISOString().slice(0, 10)}');
  `);

  console.log(`Partition ensured: ${tableName}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
