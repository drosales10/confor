import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth } from "@/lib/api-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const profile = await prisma.user.findUnique({
    where: { id: authResult.session.user.id },
    include: { profile: true, notificationPrefs: true, userRoles: { include: { role: true } } },
  });

  return ok(profile);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const firstName = body?.firstName;
  const lastName = body?.lastName;

  if (!firstName || !lastName) {
    return fail("firstName y lastName son requeridos", 400);
  }

  const user = await prisma.user.update({
    where: { id: authResult.session.user.id },
    data: {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authResult.session.user.id,
      action: "UPDATE",
      entityType: "Profile",
      entityId: user.id,
      newValues: { firstName, lastName },
    },
  });

  return ok(user);
}
