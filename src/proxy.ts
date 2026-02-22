import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { buildAbilityFromPermissions } from "@/lib/ability";
import { getRolePermissions, normalizeRole } from "@/lib/rbac";

const protectedRoutes = [
  "/dashboard",
  "/roles",
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

const routeModuleMap: Array<{ prefix: string; module: string }> = [
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/organizaciones", module: "organizations" },
  { prefix: "/roles", module: "users" },
  { prefix: "/users", module: "users" },
  { prefix: "/patrimonio-forestal", module: "forest-patrimony" },
  { prefix: "/activo-biologico", module: "forest-biological-asset" },
  { prefix: "/configuracion-forestal", module: "forest-config" },
  { prefix: "/profile", module: "profile" },
  { prefix: "/analytics", module: "analytics" },
  { prefix: "/settings", module: "settings" },
  { prefix: "/audit", module: "audit" },
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

  if (requiresAuth && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roleFromToken = Array.isArray(token?.roles) ? normalizeRole(token.roles[0] ?? null) : null;
  const roleFromCookie = normalizeRole(roleCookie ?? null);
  const permissionsFromToken = Array.isArray(token?.permissions) ? (token?.permissions as string[]) : [];
  const permissions = permissionsFromToken.length > 0
    ? permissionsFromToken
    : getRolePermissions(roleFromToken ?? roleFromCookie);
  const ability = buildAbilityFromPermissions(permissions ?? []);
  const moduleSlug = routeModuleMap.find((item) => pathname.startsWith(item.prefix))?.module ?? null;
  if (moduleSlug && !ability.can("read", moduleSlug)) {
    console.info("[RBAC] access denied", {
      pathname,
      moduleSlug,
      roleFromToken,
      roleFromCookie,
      permissions,
    });
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if ((pathname === "/login" || pathname === "/register") && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    organizationName.toLowerCase() === "por defecto" &&
    defaultOrgRestrictedRoutes.some((route) => pathname.startsWith(route))
  ) {
    console.info("[RBAC] default org restriction", {
      pathname,
      organizationName,
      roleFromToken,
      roleFromCookie,
    });
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
