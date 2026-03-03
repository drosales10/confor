import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth } from "@/lib/api-helpers";

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

export async function GET(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const { jobId } = await params;

  const job = await prisma.geoImportJob.findFirst({
    where: {
      id: jobId,
      ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
    },
    include: {
      items: {
        orderBy: { featureIndex: "asc" },
        take: 100,
      },
    },
  });

  if (!job) {
    return fail("Job no encontrado", 404);
  }

  return ok(job);
}
