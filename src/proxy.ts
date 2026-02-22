import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = [
  "/dashboard",
  "/users",
  "/organizaciones",
  "/profile",
  "/analytics",
  "/settings",
  "/audit",
  "/patrimonio-forestal",
  "/activo-biologico",
  "/configuracion-forestal",
];

const defaultOrgRestrictedRoutes = [
  "/patrimonio-forestal",
  "/activo-biologico",
  "/configuracion-forestal",
];

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requiresAuth = protectedRoutes.some((route) => pathname.startsWith(route));
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const roleCookie = req.cookies.get("RolUsuario")?.value;
  const orgNameCookie = req.cookies.get("OrgName")?.value;
  const tokenOrgName = typeof token?.organizationName === "string" ? token.organizationName : null;
  const organizationName = decodeURIComponent(orgNameCookie ?? tokenOrgName ?? "");

  if (requiresAuth && !token && !roleCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && (token || roleCookie)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    organizationName.toLowerCase() === "por defecto" &&
    defaultOrgRestrictedRoutes.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
