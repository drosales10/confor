import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth } from "@/lib/api-helpers";
import { createOrganizationSchema } from "@/validations/organization.schema";
import { generateSlug } from "@/lib/utils";

function canManageOrganizations(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

export async function GET() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });

  return ok({
    items: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      rif: (organization.settings as { rif?: string } | null)?.rif ?? "",
      createdAt: organization.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (!canManageOrganizations(roles)) {
    return fail("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const slug = generateSlug(parsed.data.name);
  const existing = await prisma.organization.findFirst({ where: { slug } });
  if (existing) {
    return fail("Ya existe una organización con ese nombre", 409);
  }

  const created = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      settings: { rif: parsed.data.rif },
    },
  });

  return ok({
    id: created.id,
    name: created.name,
    rif: parsed.data.rif,
    createdAt: created.createdAt,
  }, 201);
}
