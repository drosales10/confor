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
    ? await prisma.$queryRaw<Array<{
      id: string;
      level2_id: string;
      level2_code: string;
      level2_name: string;
      level3_id: string;
      level3_code: string;
      level3_name: string;
      level4_id: string;
      level4_code: string;
      level4_name: string;
      superficie_ha: number;
      geometry: Prisma.JsonValue;
    }>>`
        SELECT
          g.id::text,
          g.level2_id::text,
          l2.code::text AS level2_code,
          l2.name::text AS level2_name,
          g.level3_id::text,
          l3.code::text AS level3_code,
          l3.name::text AS level3_name,
          g.level4_id::text,
          l4.code::text AS level4_code,
          l4.name::text AS level4_name,
          g.superficie_ha::double precision,
          ST_AsGeoJSON(g.geom)::json AS geometry
        FROM public.forest_geometry_n4 g
        INNER JOIN "public"."ForestPatrimonyLevel2" l2 ON l2.id = g.level2_id
        INNER JOIN "public"."ForestPatrimonyLevel3" l3 ON l3.id = g.level3_id
        INNER JOIN "public"."ForestPatrimonyLevel4" l4 ON l4.id = g.level4_id
        WHERE g.is_active = TRUE
          AND g.geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        ORDER BY g.updated_at DESC, g.valid_from DESC
      `
    : await prisma.$queryRaw<Array<{
      id: string;
      level2_id: string;
      level2_code: string;
      level2_name: string;
      level3_id: string;
      level3_code: string;
      level3_name: string;
      level4_id: string;
      level4_code: string;
      level4_name: string;
      superficie_ha: number;
      geometry: Prisma.JsonValue;
    }>>`
        SELECT
          g.id::text,
          g.level2_id::text,
          l2.code::text AS level2_code,
          l2.name::text AS level2_name,
          g.level3_id::text,
          l3.code::text AS level3_code,
          l3.name::text AS level3_name,
          g.level4_id::text,
          l4.code::text AS level4_code,
          l4.name::text AS level4_name,
          g.superficie_ha::double precision,
          ST_AsGeoJSON(g.geom)::json AS geometry
        FROM public.forest_geometry_n4 g
        INNER JOIN "public"."ForestPatrimonyLevel2" l2 ON l2.id = g.level2_id
        INNER JOIN "public"."ForestPatrimonyLevel3" l3 ON l3.id = g.level3_id
        INNER JOIN "public"."ForestPatrimonyLevel4" l4 ON l4.id = g.level4_id
        WHERE g.is_active = TRUE
          AND g.organization_id = ${organizationId}::uuid
          AND g.geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        ORDER BY g.updated_at DESC, g.valid_from DESC
      `;

  return ok({
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: row.geometry,
      properties: {
        id: row.id,
        level2Id: row.level2_id,
        level2Code: row.level2_code,
        level2Name: row.level2_name,
        level3Id: row.level3_id,
        level3Code: row.level3_code,
        level3Name: row.level3_name,
        level4Id: row.level4_id,
        level4Code: row.level4_code,
        level4Name: row.level4_name,
        surfaceHa: row.superficie_ha,
      },
    })),
  });
}
