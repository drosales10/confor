import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { processGeoImportJob, processNextPendingImportJob, processNextRecalcJob } from "@/lib/geo-import-worker";

type WorkerBody = {
  mode?: "import" | "recalc";
  jobId?: string;
};

export async function POST(req: NextRequest) {
  const workerSecret = process.env.GEO_WORKER_SECRET;
  if (workerSecret) {
    const provided = req.headers.get("x-worker-secret");
    if (provided !== workerSecret) {
      return fail("Forbidden", 403);
    }
  } else {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin) {
      const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "UPDATE");
      if (permissionError) return permissionError;
    }
  }

  const body = (await req.json().catch(() => ({}))) as WorkerBody;
  const mode = body.mode ?? "import";

  if (mode === "import") {
    const result = body.jobId ? await processGeoImportJob(body.jobId) : await processNextPendingImportJob();
    return ok(result);
  }

  const result = await processNextRecalcJob();
  return ok(result);
}
