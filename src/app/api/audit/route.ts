import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, requirePermission, fail } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "audit", "READ");
  if (permissionError) return permissionError;

  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const action = req.nextUrl.searchParams.get("action") ?? undefined;
  const entityType = req.nextUrl.searchParams.get("entityType") ?? undefined;

  const where = {
    ...(action ? { action: action as never } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  return ok({
    items: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "audit", "EXPORT");
  if (permissionError) return permissionError;

  const body = await req.json();
  const exportFormat = body?.format === "json" ? "json" : "csv";

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "EXPORT",
      entityType: "AuditLog",
      metadata: { format: exportFormat },
    },
  });

  if (exportFormat === "json") {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return ok({ checksum: `audit-${Date.now()}`, data: logs });
  }

  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const header = "id,action,entityType,entityId,userId,createdAt";
  const rows = logs.map((log) =>
    [log.id, log.action, log.entityType ?? "", log.entityId ?? "", log.userId ?? "", log.createdAt.toISOString()].join(","),
  );

  return ok({ checksum: `audit-${Date.now()}`, csv: [header, ...rows].join("\n") });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissionError = requirePermission(authResult.session.user.permissions, "audit", "DELETE");
  if (permissionError) return permissionError;

  try {
    await prisma.auditLog.deleteMany({});
    return ok({ success: true });
  } catch (error) {
    return fail("No se pudieron eliminar los registros de auditoría", 500);
  }
}

