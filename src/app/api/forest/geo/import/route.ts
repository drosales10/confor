import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";

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

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const canImport =
      hasPermission(authResult.session.user.permissions ?? [], "forest-patrimony", "CREATE") ||
      hasPermission(authResult.session.user.permissions ?? [], "forest-patrimony", "UPDATE");

    if (!canImport) {
      const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "CREATE");
      if (permissionError) return permissionError;
    }
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return fail("Debe adjuntar un archivo", 400);
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return fail("El archivo debe ser .zip", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const zip = await JSZip.loadAsync(buffer);
  const fileNames = Object.keys(zip.files).map((name) => name.toLowerCase());
  const requiredExtensions = [".shp", ".shx", ".dbf", ".prj"];
  const missing = requiredExtensions.filter((ext) => !fileNames.some((name) => name.endsWith(ext)));

  if (missing.length > 0) {
    return fail(`ZIP incompleto. Faltan archivos obligatorios: ${missing.join(", ")}`, 400);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "geo-imports");
  await fs.mkdir(uploadsDir, { recursive: true });

  const job = await prisma.geoImportJob.create({
    data: {
      organizationId,
      fileName: file.name,
      storagePath: "",
      createdById: authResult.session.user.id,
      metadata: {
        requiredExtensions,
      },
    },
  });

  const storagePath = path.join(uploadsDir, `${job.id}.zip`);
  await fs.writeFile(storagePath, buffer);

  await prisma.geoImportJob.update({
    where: { id: job.id },
    data: { storagePath },
  });

  const workerSecret = process.env.GEO_WORKER_SECRET;
  const workerUrl = new URL("/api/forest/geo/import/worker", req.nextUrl.origin).toString();

  void fetch(workerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(workerSecret ? { "x-worker-secret": workerSecret } : {}),
    },
    body: JSON.stringify({ jobId: job.id, mode: "import" }),
  }).catch(() => {
    // no-op: el job queda PENDING para ejecución manual/scheduled
  });

  return ok({
    jobId: job.id,
    status: job.status,
    message: "Archivo recibido. El worker procesará la importación en segundo plano.",
  }, 202);
}
