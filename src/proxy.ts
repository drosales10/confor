import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = ["/dashboard", "/users", "/profile", "/analytics", "/settings", "/audit"];

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requiresAuth = protectedRoutes.some((route) => pathname.startsWith(route));
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (requiresAuth && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
