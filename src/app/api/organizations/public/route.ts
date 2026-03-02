import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export async function GET() {
  const organizations = await prisma.organization.findMany({
    where: {
      deletedAt: null,
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      settings: true,
    },
  });

  return ok({
    items: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      rif: (organization.settings as { rif?: string } | null)?.rif ?? "",
    })),
  });
}
