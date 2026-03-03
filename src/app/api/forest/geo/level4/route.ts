import { type NextRequest } from "next/server";
import { Prisma, PatrimonyLevel4Type, FscCertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";

const LEVEL4_TYPES = new Set<PatrimonyLevel4Type>([
  "RODAL",
  "PARCELA",
  "ENUMERATION",
  "UNIDAD_DE_MANEJO",
  "CONUCO",
  "OTRO_USO",
]);

const FSC_TYPES = new Set<FscCertificateStatus>(["SI", "NO"]);

type CreateLevel4FromMapPayload = {
  level2Id: string;
  level3Id: string;
  code: string;
  name: string;
  type: PatrimonyLevel4Type;
  fscCertificateStatus: FscCertificateStatus;
  currentLandUseName: string;
  previousLandUseName?: string | null;
  rotationPhase?: string | null;
  previousUse?: string | null;
  polygon: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
};

type UpdateLevel4FromMapPayload = {
  level4Id: string;
  code?: string;
  name?: string;
  type?: PatrimonyLevel4Type;
  fscCertificateStatus?: FscCertificateStatus;
  currentLandUseName?: string;
  previousLandUseName?: string | null;
  rotationPhase?: string | null;
  previousUse?: string | null;
  polygon?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parsePayload(body: unknown): CreateLevel4FromMapPayload | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  const level2Id = String(payload.level2Id ?? "").trim();
  const level3Id = String(payload.level3Id ?? "").trim();
  const code = String(payload.code ?? "").trim();
  const name = String(payload.name ?? "").trim();
  const type = String(payload.type ?? "") as PatrimonyLevel4Type;
  const fscCertificateStatus = String(payload.fscCertificateStatus ?? "") as FscCertificateStatus;
  const currentLandUseName = String(payload.currentLandUseName ?? "").trim();
  const previousLandUseName = typeof payload.previousLandUseName === "string" ? payload.previousLandUseName.trim() : null;
  const rotationPhase = typeof payload.rotationPhase === "string" ? payload.rotationPhase.trim() : null;
  const previousUse = typeof payload.previousUse === "string" ? payload.previousUse.trim() : null;

  const polygonRaw = payload.polygon as Record<string, unknown> | undefined;
  const polygonType = polygonRaw?.type;
  const coordinates = polygonRaw?.coordinates;

  if (!isUuid(level2Id) || !isUuid(level3Id)) return null;
  if (!code || !name) return null;
  if (!currentLandUseName) return null;
  if (!LEVEL4_TYPES.has(type)) return null;
  if (!FSC_TYPES.has(fscCertificateStatus)) return null;
  if (polygonType !== "Polygon" && polygonType !== "MultiPolygon") return null;
  if (coordinates === undefined) return null;

  return {
    level2Id,
    level3Id,
    code,
    name,
    type,
    fscCertificateStatus,
    currentLandUseName,
    previousLandUseName,
    rotationPhase,
    previousUse,
    polygon: {
      type: polygonType,
      coordinates,
    },
  };
}

function parseUpdatePayload(body: unknown): UpdateLevel4FromMapPayload | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  const level4Id = String(payload.level4Id ?? "").trim();
  if (!isUuid(level4Id)) return null;

  const result: UpdateLevel4FromMapPayload = { level4Id };

  if (typeof payload.code === "string") {
    const code = payload.code.trim();
    if (!code) return null;
    result.code = code;
  }

  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!name) return null;
    result.name = name;
  }

  if (payload.type !== undefined) {
    const type = String(payload.type) as PatrimonyLevel4Type;
    if (!LEVEL4_TYPES.has(type)) return null;
    result.type = type;
  }

  if (payload.fscCertificateStatus !== undefined) {
    const fsc = String(payload.fscCertificateStatus) as FscCertificateStatus;
    if (!FSC_TYPES.has(fsc)) return null;
    result.fscCertificateStatus = fsc;
  }

  if (payload.currentLandUseName !== undefined) {
    const currentLandUseName = String(payload.currentLandUseName).trim();
    if (!currentLandUseName) return null;
    result.currentLandUseName = currentLandUseName;
  }

  if (payload.previousLandUseName !== undefined) {
    if (payload.previousLandUseName === null) {
      result.previousLandUseName = null;
    } else {
      const previousLandUseName = String(payload.previousLandUseName).trim();
      result.previousLandUseName = previousLandUseName || null;
    }
  }

  if (payload.rotationPhase !== undefined) {
    result.rotationPhase = typeof payload.rotationPhase === "string" ? payload.rotationPhase.trim() || null : null;
  }

  if (payload.previousUse !== undefined) {
    result.previousUse = typeof payload.previousUse === "string" ? payload.previousUse.trim() || null : null;
  }

  if (payload.polygon !== undefined) {
    const polygonRaw = payload.polygon as Record<string, unknown>;
    const polygonType = polygonRaw?.type;
    const coordinates = polygonRaw?.coordinates;

    if ((polygonType !== "Polygon" && polygonType !== "MultiPolygon") || coordinates === undefined) {
      return null;
    }

    result.polygon = {
      type: polygonType,
      coordinates,
    };
  }

  const hasUpdateField = result.code !== undefined
    || result.name !== undefined
    || result.type !== undefined
    || result.fscCertificateStatus !== undefined
    || result.currentLandUseName !== undefined
    || result.previousLandUseName !== undefined
    || result.rotationPhase !== undefined
    || result.previousUse !== undefined
    || result.polygon !== undefined;

  if (!hasUpdateField) return null;
  return result;
}

async function syncLevel4Metrics(tx: Prisma.TransactionClient, organizationId: string, level4Id: string) {
  const metrics = await tx.$queryRaw<Array<{ superficie_ha: number; lat: number | null; lon: number | null }>>`
    SELECT
      superficie_ha::double precision AS superficie_ha,
      ST_Y(centroid) AS lat,
      ST_X(centroid) AS lon
    FROM public.forest_geometry_n4
    WHERE organization_id = ${organizationId}::uuid
      AND level4_id = ${level4Id}::uuid
      AND is_active = TRUE
    ORDER BY valid_from DESC
    LIMIT 1
  `;

  const metric = metrics.at(0);
  await tx.forestPatrimonyLevel4.update({
    where: { id: level4Id },
    data: {
      totalAreaHa: metric?.superficie_ha ?? 0,
      centroidLatitude: metric?.lat ?? null,
      centroidLongitude: metric?.lon ?? null,
      lastInfoDate: new Date(),
    },
  });
}

async function validateLandUseName(tx: Prisma.TransactionClient, organizationId: string, value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;

  const exists = await tx.landUseType.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: {
        equals: normalized,
        mode: "insensitive",
      },
    },
    select: { id: true, name: true },
  });

  return exists?.name ?? null;
}

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

async function readJsonBody(req: NextRequest) {
  try {
    const body = await req.json();
    return { body } as const;
  } catch {
    return { error: fail("Body JSON inválido o vacío", 400) } as const;
  }
}

function mapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("Ya existe un rodal con ese código para el Nivel 3 seleccionado", 409);
    }
  }

  const message = error instanceof Error ? error.message : "No fue posible crear el rodal desde el mapa";
  return fail(message, 400);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "CREATE");
    if (permissionError) return permissionError;
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const bodyResult = await readJsonBody(req);
  if ("error" in bodyResult) return bodyResult.error;

  const body = bodyResult.body;
  const payload = parsePayload(body);
  if (!payload) {
    return fail("Payload inválido para creación de Nivel 4", 400);
  }

  const level3 = await prisma.forestPatrimonyLevel3.findFirst({
    where: {
      id: payload.level3Id,
      level2Id: payload.level2Id,
      isActive: true,
      ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
    },
    include: {
      level2: true,
    },
  });

  if (!level3) {
    return fail("Nivel 3 no encontrado o no corresponde al Nivel 2 seleccionado", 404);
  }

  const level3OrganizationId = level3.level2.organizationId;
  if (!level3OrganizationId) {
    return fail("El nivel seleccionado no tiene organización asociada", 409);
  }

  const geometryJson = JSON.stringify(payload.polygon);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const currentLandUseName = await validateLandUseName(tx, level3OrganizationId, payload.currentLandUseName);
      if (!currentLandUseName) {
        throw new Error("El uso actual no existe en la tabla auxiliar de Uso de Suelos");
      }

      const previousLandUseName = await validateLandUseName(tx, level3OrganizationId, payload.previousLandUseName ?? null);
      if (payload.previousLandUseName && !previousLandUseName) {
        throw new Error("El uso antiguo no existe en la tabla auxiliar de Uso de Suelos");
      }

      const level4 = await tx.forestPatrimonyLevel4.create({
        data: {
          level3Id: payload.level3Id,
          code: payload.code,
          name: payload.name,
          type: payload.type,
          fscCertificateStatus: payload.fscCertificateStatus,
          currentLandUseName,
          previousLandUseName,
          totalAreaHa: 0,
          rotationPhase: payload.rotationPhase || null,
          previousUse: payload.previousUse || null,
          isActive: true,
          lastInfoDate: new Date(),
        },
      });

      await tx.$executeRaw`
        UPDATE "public"."ForestPatrimonyLevel4"
        SET "landUseChangeDate" = NOW()
        WHERE id = ${level4.id}::uuid
      `;

      await tx.$executeRaw`
        INSERT INTO public.forest_geometry_n4 (
          id,
          organization_id,
          level2_id,
          level3_id,
          level4_id,
          geom,
          is_active,
          valid_from,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          ${level3OrganizationId}::uuid,
          ${payload.level2Id}::uuid,
          ${payload.level3Id}::uuid,
          ${level4.id}::uuid,
          ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${geometryJson})), 4326),
          TRUE,
          NOW(),
          NOW(),
          NOW()
        )
      `;

      const metrics = await tx.$queryRaw<Array<{ superficie_ha: number; lat: number | null; lon: number | null }>>`
        SELECT
          superficie_ha::double precision AS superficie_ha,
          ST_Y(centroid) AS lat,
          ST_X(centroid) AS lon
        FROM public.forest_geometry_n4
        WHERE organization_id = ${level3OrganizationId}::uuid
          AND level4_id = ${level4.id}::uuid
          AND is_active = TRUE
        ORDER BY valid_from DESC
        LIMIT 1
      `;

      const metric = metrics.at(0);
      if (metric) {
        await tx.forestPatrimonyLevel4.update({
          where: { id: level4.id },
          data: {
            totalAreaHa: metric.superficie_ha,
            centroidLatitude: metric.lat,
            centroidLongitude: metric.lon,
          },
        });
      }

      return level4;
    });

    return ok(created, 201);
  } catch (error) {
    return mapError(error);
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "READ");
    if (permissionError) return permissionError;
  }

  const level4Id = String(req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!isUuid(level4Id)) {
    return fail("Parámetro id inválido", 400);
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const level4 = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: level4Id,
      isActive: true,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
    include: {
      level3: {
        include: {
          level2: { select: { id: true, organizationId: true } },
        },
      },
    },
  });

  if (!level4) {
    return fail("Nivel 4 no encontrado", 404);
  }

  const activeOrganizationId = level4.level3.level2.organizationId;
  if (!activeOrganizationId) {
    return fail("El Nivel 4 seleccionado no tiene organización asociada", 409);
  }
  const geometryRows = await prisma.$queryRaw<Array<{ geometry: Prisma.JsonValue }>>`
    SELECT ST_AsGeoJSON(geom)::json AS geometry
    FROM public.forest_geometry_n4
    WHERE organization_id = ${activeOrganizationId}::uuid
      AND level4_id = ${level4.id}::uuid
      AND is_active = TRUE
    ORDER BY valid_from DESC
    LIMIT 1
  `;

  return ok({
    id: level4.id,
    level2Id: level4.level3.level2.id,
    level3Id: level4.level3Id,
    code: level4.code,
    name: level4.name,
    type: level4.type,
    fscCertificateStatus: level4.fscCertificateStatus,
    currentLandUseName: level4.currentLandUseName,
    previousLandUseName: level4.previousLandUseName,
    rotationPhase: level4.rotationPhase,
    previousUse: level4.previousUse,
    totalAreaHa: level4.totalAreaHa,
    geometry: geometryRows.at(0)?.geometry ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "UPDATE");
    if (permissionError) return permissionError;
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const bodyResult = await readJsonBody(req);
  if ("error" in bodyResult) return bodyResult.error;

  const body = bodyResult.body;
  const payload = parseUpdatePayload(body);
  if (!payload) {
    return fail("Payload inválido para actualización de Nivel 4", 400);
  }

  const current = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: payload.level4Id,
      isActive: true,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
    include: {
      level3: {
        include: {
          level2: { select: { id: true, organizationId: true } },
        },
      },
    },
  });

  if (!current) {
    return fail("Nivel 4 no encontrado", 404);
  }

  const activeOrganizationId = current.level3.level2.organizationId;
  if (!activeOrganizationId) {
    return fail("El Nivel 4 seleccionado no tiene organización asociada", 409);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      let currentLandUseName: string | null | undefined;
      if (payload.currentLandUseName !== undefined) {
        currentLandUseName = await validateLandUseName(tx, activeOrganizationId, payload.currentLandUseName);
        if (!currentLandUseName) {
          throw new Error("El uso actual no existe en la tabla auxiliar de Uso de Suelos");
        }
      }

      let previousLandUseName: string | null | undefined;
      if (payload.previousLandUseName !== undefined) {
        if (payload.previousLandUseName === null) {
          previousLandUseName = null;
        } else {
          previousLandUseName = await validateLandUseName(tx, activeOrganizationId, payload.previousLandUseName);
          if (!previousLandUseName) {
            throw new Error("El uso antiguo no existe en la tabla auxiliar de Uso de Suelos");
          }
        }
      }

      const shouldStampLandUseChangeDate = payload.polygon !== undefined
        || payload.currentLandUseName !== undefined
        || payload.previousLandUseName !== undefined;

      const updatedRow = await tx.forestPatrimonyLevel4.update({
        where: { id: current.id },
        data: {
          ...(payload.code !== undefined ? { code: payload.code } : {}),
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.type !== undefined ? { type: payload.type } : {}),
          ...(payload.fscCertificateStatus !== undefined ? { fscCertificateStatus: payload.fscCertificateStatus } : {}),
          ...(currentLandUseName !== undefined ? { currentLandUseName } : {}),
          ...(previousLandUseName !== undefined ? { previousLandUseName } : {}),
          ...(payload.rotationPhase !== undefined ? { rotationPhase: payload.rotationPhase } : {}),
          ...(payload.previousUse !== undefined ? { previousUse: payload.previousUse } : {}),
          lastInfoDate: new Date(),
        },
      });

      if (shouldStampLandUseChangeDate) {
        await tx.$executeRaw`
          UPDATE "public"."ForestPatrimonyLevel4"
          SET "landUseChangeDate" = NOW()
          WHERE id = ${current.id}::uuid
        `;
      }

      if (payload.polygon) {
        const geometryJson = JSON.stringify(payload.polygon);
        await tx.$executeRaw`
          UPDATE public.forest_geometry_n4
          SET is_active = FALSE,
              valid_to = NOW(),
              updated_at = NOW()
          WHERE organization_id = ${activeOrganizationId}::uuid
            AND level4_id = ${current.id}::uuid
            AND is_active = TRUE
        `;

        await tx.$executeRaw`
          INSERT INTO public.forest_geometry_n4 (
            id,
            organization_id,
            level2_id,
            level3_id,
            level4_id,
            geom,
            is_active,
            valid_from,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${activeOrganizationId}::uuid,
            ${current.level3.level2.id}::uuid,
            ${current.level3Id}::uuid,
            ${current.id}::uuid,
            ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${geometryJson})), 4326),
            TRUE,
            NOW(),
            NOW(),
            NOW()
          )
        `;
      }

      await syncLevel4Metrics(tx, activeOrganizationId, current.id);
      return updatedRow;
    });

    return ok(updated);
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions, "forest-patrimony", "DELETE");
    if (permissionError) return permissionError;
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const bodyResult = await readJsonBody(req);
  if ("error" in bodyResult) return bodyResult.error;

  const body = bodyResult.body;
  const level4Id = String((body as Record<string, unknown>)?.level4Id ?? "").trim();
  if (!isUuid(level4Id)) {
    return fail("Payload inválido para eliminación de Nivel 4", 400);
  }

  const current = await prisma.forestPatrimonyLevel4.findFirst({
    where: {
      id: level4Id,
      isActive: true,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
    },
    include: {
      level3: {
        include: {
          level2: { select: { organizationId: true } },
        },
      },
    },
  });

  if (!current) {
    return fail("Nivel 4 no encontrado", 404);
  }

  const childrenCount = await prisma.forestPatrimonyLevel5.count({ where: { level4Id: current.id } });
  if (childrenCount > 0) {
    return fail("No se puede eliminar el nivel 4 porque tiene niveles 5 relacionados", 409);
  }

  const activeOrganizationId = current.level3.level2.organizationId;
  if (!activeOrganizationId) {
    return fail("El Nivel 4 seleccionado no tiene organización asociada", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE public.forest_geometry_n4
      SET is_active = FALSE,
          valid_to = NOW(),
          updated_at = NOW()
      WHERE organization_id = ${activeOrganizationId}::uuid
        AND level4_id = ${current.id}::uuid
        AND is_active = TRUE
    `;

    await tx.forestPatrimonyLevel4.update({
      where: { id: current.id },
      data: {
        isActive: false,
        lastInfoDate: new Date(),
      },
    });
  });

  return ok({ message: "Nivel 4 eliminado" });
}
