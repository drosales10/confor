import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/crypto";
import { registerSchema } from "@/validations/auth.schema";
import { fail, ok } from "@/lib/api-helpers";
import { generateSlug } from "@/lib/utils";
import { ensureRoleWithPermissions } from "@/lib/role-provisioning";

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

  const defaultOrgName = "Por defecto";
  const defaultOrgSlug = generateSlug(defaultOrgName);
  const organization = await prisma.organization.upsert({
    where: { slug: defaultOrgSlug },
    update: {},
    create: {
      name: defaultOrgName,
      slug: defaultOrgSlug,
      isActive: true,
    },
  });

  const role = await ensureRoleWithPermissions("USER", organization.id);
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      status: "PENDING_VERIFICATION",
      organizationId: organization.id,
      userRoles: {
        create: {
          roleId: role.id,
          assignedBy: null,
        },
      },
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

  return ok({ message: "Cuenta creada. Pendiente de aprobacion por un ADMIN." }, 201);
}
