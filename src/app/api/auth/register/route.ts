import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSecureToken, hashToken } from "@/lib/crypto";
import { registerSchema } from "@/validations/auth.schema";
import { fail, ok } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Datos inválidos", 400, parsed.error.flatten());
  }

  const { email, firstName, lastName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("El email ya existe", 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      status: "PENDING_VERIFICATION",
    },
  });

  const token = generateSecureToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
    },
  });

  return ok({ message: "Cuenta creada. Verifica tu correo.", verificationToken: token }, 201);
}
