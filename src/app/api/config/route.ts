import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { updateSystemConfigSchema } from "@/validations/config.schema";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "settings", "READ");
    if (permissionError) return permissionError;
  }

  const configs = await prisma.systemConfiguration.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  return ok(configs);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "settings", "UPDATE");
    if (permissionError) return permissionError;
  }

  const body = await req.json();
  const parsed = updateSystemConfigSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const { category, key, value, configType } = parsed.data;

  const existing = await prisma.systemConfiguration.findFirst({
    where: {
      organizationId: null,
      category,
      key,
    },
  });

  const config = existing
    ? await prisma.systemConfiguration.update({
        where: { id: existing.id },
        data: {
          value,
          configType,
          updatedBy: authResult.session.user.id,
        },
      })
    : await prisma.systemConfiguration.create({
        data: {
          organizationId: null,
          category,
          key,
          value,
          configType,
          updatedBy: authResult.session.user.id,
        },
      });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "SystemConfiguration",
      entityId: config.id,
      newValues: { category, key, value, configType },
    },
  });

  return ok(config);
}
