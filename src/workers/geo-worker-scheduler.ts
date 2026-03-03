import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processNextPendingImportJob, processNextRecalcJob } from "@/lib/geo-import-worker";

const intervalMs = Number.parseInt(process.env.GEO_WORKER_INTERVAL_MS ?? "4000", 10);
const importBatchSize = Number.parseInt(process.env.GEO_IMPORT_BATCH_SIZE ?? "5", 10);
const recalcBatchSize = Number.parseInt(process.env.GEO_RECALC_BATCH_SIZE ?? "10", 10);
const runOnce = process.env.GEO_WORKER_RUN_ONCE === "true";

let running = false;
let stopped = false;

function now() {
  return new Date().toISOString();
}

async function runBatch() {
  if (running || stopped) {
    return;
  }

  running = true;

  try {
    let importProcessed = 0;
    let recalcProcessed = 0;

    for (let i = 0; i < importBatchSize; i += 1) {
      const result = await processNextPendingImportJob();
      if (!result.processed) {
        break;
      }
      importProcessed += 1;
    }

    for (let i = 0; i < recalcBatchSize; i += 1) {
      const result = await processNextRecalcJob();
      if (!result.processed) {
        break;
      }
      recalcProcessed += 1;
    }

    if (importProcessed > 0 || recalcProcessed > 0) {
      console.info(
        `[${now()}] [geo-worker] processed import_jobs=${importProcessed} recalc_jobs=${recalcProcessed}`,
      );
    }
  } catch (error) {
    console.error(`[${now()}] [geo-worker] batch error`, error);
  } finally {
    running = false;
  }
}

async function shutdown(signal: string) {
  if (stopped) {
    return;
  }

  stopped = true;
  console.info(`[${now()}] [geo-worker] stopping scheduler (${signal})...`);

  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

async function main() {
  console.info(
    `[${now()}] [geo-worker] started (interval=${intervalMs}ms, importBatch=${importBatchSize}, recalcBatch=${recalcBatchSize}, runOnce=${runOnce})`,
  );

  await runBatch();

  if (runOnce) {
    await shutdown("run_once");
    return;
  }

  const timer = setInterval(() => {
    void runBatch();
  }, intervalMs);

  process.on("SIGINT", () => {
    clearInterval(timer);
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    clearInterval(timer);
    void shutdown("SIGTERM");
  });
}

void main();
