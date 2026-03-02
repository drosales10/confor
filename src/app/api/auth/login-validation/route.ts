import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";

  if (!email || !organizationId) {
    return fail("Datos inválidos", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      organizationId: true,
      status: true,
      organization: {
        select: {
          id: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!user) {
    return ok({ canAttemptLogin: true });
  }

  if (!user.organizationId || user.organizationId !== organizationId) {
    return fail("El usuario no pertenece a la organización seleccionada", 409, {
      code: "USER_NOT_IN_ORG",
    });
  }

  if (!user.organization || !user.organization.isActive || user.organization.deletedAt) {
    return fail("La organización seleccionada no está disponible", 409, {
      code: "ORG_NOT_AVAILABLE",
    });
  }

  if (user.status !== "ACTIVE") {
    return fail("El usuario no está activo", 409, {
      code: "USER_NOT_ACTIVE",
    });
  }

  return ok({ canAttemptLogin: true });
}
