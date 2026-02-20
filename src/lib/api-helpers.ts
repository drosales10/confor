import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: fail("Unauthorized", 401) };
  }
  return { session };
}

export function requirePermission(permissions: string[], moduleSlug: string, action: string) {
  if (!hasPermission(permissions, moduleSlug, action)) {
    return fail("Forbidden", 403);
  }
  return null;
}
