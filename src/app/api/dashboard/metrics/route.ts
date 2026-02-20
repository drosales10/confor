import { prisma } from "@/lib/prisma";
import { ok, requireAuth } from "@/lib/api-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const [usersTotal, usersActive, pendingNotifications, auditTotal] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.notification.count({ where: { status: "PENDING" } }),
    prisma.auditLog.count(),
  ]);

  return ok({
    usersTotal,
    usersActive,
    pendingNotifications,
    auditTotal,
    generatedAt: new Date().toISOString(),
  });
}
