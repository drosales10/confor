import { PermissionAction } from "@prisma/client";
import { NextRequest } from "next/server";
import { fail, ok, requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { upsertModuleSchema } from "@/validations/config.schema";

function canManageModules(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

const DEFAULT_ACTIONS: PermissionAction[] = ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT", "ADMIN"];

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (!canManageModules(roles)) {
    return fail("Forbidden", 403);
  }

  const modules = await prisma.module.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      permissions: {
        orderBy: { action: "asc" },
      },
    },
  });

  return ok(
    modules.map((moduleItem) => ({
      id: moduleItem.id,
      name: moduleItem.name,
      slug: moduleItem.slug,
      routePath: moduleItem.routePath,
      displayOrder: moduleItem.displayOrder,
      isActive: moduleItem.isActive,
      permissions: moduleItem.permissions.map((permission) => ({
        id: permission.id,
        action: permission.action,
      })),
    })),
  );
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (!canManageModules(roles)) {
    return fail("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = upsertModuleSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const normalizedSlug = parsed.data.slug.trim().toLowerCase();
  const normalizedRoutePath = parsed.data.routePath.startsWith("/")
    ? parsed.data.routePath.trim()
    : `/${parsed.data.routePath.trim()}`;

  const moduleItem = await prisma.module.upsert({
    where: { slug: normalizedSlug },
    update: {
      name: parsed.data.name.trim(),
      routePath: normalizedRoutePath,
      description: parsed.data.description?.trim() || null,
      icon: parsed.data.icon?.trim() || null,
      displayOrder: parsed.data.displayOrder,
      isActive: parsed.data.isActive ?? true,
    },
    create: {
      name: parsed.data.name.trim(),
      slug: normalizedSlug,
      routePath: normalizedRoutePath,
      description: parsed.data.description?.trim() || null,
      icon: parsed.data.icon?.trim() || null,
      displayOrder: parsed.data.displayOrder,
      isActive: parsed.data.isActive ?? true,
    },
  });

  await prisma.permission.createMany({
    data: DEFAULT_ACTIONS.map((action) => ({
      moduleId: moduleItem.id,
      action,
      name: `${moduleItem.name} ${action}`,
    })),
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "CREATE",
      entityType: "Module",
      entityId: moduleItem.id,
      newValues: {
        slug: moduleItem.slug,
        name: moduleItem.name,
      },
    },
  });

  const withPermissions = await prisma.module.findUnique({
    where: { id: moduleItem.id },
    include: {
      permissions: {
        orderBy: { action: "asc" },
      },
    },
  });

  return ok(withPermissions, 201);
}
