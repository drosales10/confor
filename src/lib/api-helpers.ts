import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getUserRolesAndPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    const cookieStore = await cookies();
    const emailFromCookie = cookieStore.get("EmailUsuario")?.value ?? null;
    if (!emailFromCookie) {
      return { error: fail("Unauthorized", 401) };
    }

    const user = await prisma.user.findUnique({ where: { email: emailFromCookie } });
    if (!user) {
      return { error: fail("Unauthorized", 401) };
    }

    const roleInfo = await getUserRolesAndPermissions(user.id);
    return {
      session: {
        user: {
          id: user.id,
          roles: roleInfo.roles,
          permissions: roleInfo.permissions,
        },
      },
    };
  }
  return { session };
}

export function requirePermission(permissions: string[], moduleSlug: string, action: string) {
  if (!hasPermission(permissions, moduleSlug, action)) {
    return fail("Forbidden", 403);
  }
  return null;
}
