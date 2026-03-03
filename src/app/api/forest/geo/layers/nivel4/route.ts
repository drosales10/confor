import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";

async function resolveOrganizationId(sessionUser: { id?: string; organizationId?: string | null }) {
  if (sessionUser.organizationId !== undefined) {
    return sessionUser.organizationId;
  }

  if (!sessionUser.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { organizationId: true },
  });

  return user?.organizationId ?? null;
}

function parseBbox(value: string | null): [number, number, number, number] | null {
  if (!value) return null;
  const parts = value.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const canRead = hasPermission(authResult.session.user.permissions ?? [], "forest-patrimony", "READ");
    if (!canRead) {
      const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "READ");
      if (permissionError) return permissionError;
    }
  }

  const bbox = parseBbox(req.nextUrl.searchParams.get("bbox"));
  if (!bbox) {
    return fail("Parámetro bbox inválido. Formato esperado: minLon,minLat,maxLon,maxLat", 400);
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const rows = isSuperAdmin
    ? await prisma.$queryRaw<Array<{ id: string; level4_id: string; superficie_ha: number; geometry: Prisma.JsonValue }>>`
        SELECT
          id::text,
          level4_id::text,
          superficie_ha::double precision,
          ST_AsGeoJSON(geom)::json AS geometry
        FROM public.forest_geometry_n4
        WHERE is_active = TRUE
          AND geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        LIMIT 5000
      `
    : await prisma.$queryRaw<Array<{ id: string; level4_id: string; superficie_ha: number; geometry: Prisma.JsonValue }>>`
        SELECT
          id::text,
          level4_id::text,
          superficie_ha::double precision,
          ST_AsGeoJSON(geom)::json AS geometry
        FROM public.forest_geometry_n4
        WHERE is_active = TRUE
          AND organization_id = ${organizationId}::uuid
          AND geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        LIMIT 5000
      `;

  return ok({
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: row.geometry,
      properties: {
        id: row.id,
        level4Id: row.level4_id,
        surfaceHa: row.superficie_ha,
      },
    })),
  });
}
