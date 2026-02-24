import { ok, fail } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id, isActive: true },
    select: { id: true, name: true, logoUrl: true, country: { select: { flagUrl: true } } } as any,
  });

  if (!organization) {
    return fail("Organización no encontrada", 404);
  }

  const config = await prisma.systemConfiguration.findFirst({
    where: {
      organizationId: (organization as any).id,
      category: "general",
      key: "site_name",
    },
    select: { value: true },
  });

  return ok({
    organization,
    appTitle: config?.value?.trim() || null,
  });
}
