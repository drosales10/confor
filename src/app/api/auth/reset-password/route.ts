import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-helpers";
import { hashPassword, hashToken } from "@/lib/crypto";
import { resetPasswordSchema } from "@/validations/auth.schema";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return fail("Token inválido o expirado", 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: resetToken.userId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: resetToken.userId,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: resetToken.userId,
      },
    }),
  ]);

  return ok({ message: "Contraseña actualizada correctamente" });
}
