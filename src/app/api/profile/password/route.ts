import { fail, ok, requireAuth } from "@/lib/api-helpers";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/validations/auth.schema";

export async function PATCH(req: Request) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const userId = authResult.session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, authProvider: true },
  });

  if (!user) {
    return fail("Usuario no encontrado", 404);
  }

  if (!user.passwordHash || user.authProvider !== "LOCAL") {
    return fail("Este usuario no tiene contraseña local configurable", 400);
  }

  const isCurrentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    return fail("La contraseña actual no es válida", 400);
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
    },
  });

  return ok({ message: "Contraseña actualizada" });
}
