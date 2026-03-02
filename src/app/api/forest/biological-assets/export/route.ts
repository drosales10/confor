import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const sortKeys = ["biologicalAssetKey", "accountingKey", "assetType", "plantingYear", "inventoryCode", "isActive", "createdAt"] as const;
type SortKey = (typeof sortKeys)[number];

type ExportRow = {
  id: string;
  level4Id: string;
  biologicalAssetKey: string;
  accountingKey: string;
  assetType: "COMERCIAL" | "INVESTIGACION";
  plantingYear: number | null;
  inventoryCode: string;
  isActive: boolean;
  createdAt: string;
};

function resolveExportMaxLimit() {
  const raw = process.env.FOREST_BIOLOGICAL_ASSET_EXPORT_MAX_LIMIT;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.floor(parsed);
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

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function formatDate(value: Date | null) {
  return value ? value.toISOString() : "";
}

function formatNumeric(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return value.toString();
  }
  return String(value);
}

function sortRows(rows: ExportRow[], sortBy: SortKey, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    if (sortBy === "isActive") {
      return ((left.isActive ? 1 : 0) - (right.isActive ? 1 : 0)) * direction;
    }

    if (sortBy === "plantingYear") {
      return ((left.plantingYear ?? -Infinity) - (right.plantingYear ?? -Infinity)) * direction;
    }

    if (sortBy === "createdAt") {
      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    }

    const leftValue =
      sortBy === "accountingKey"
        ? left.accountingKey
        : sortBy === "assetType"
          ? left.assetType
          : sortBy === "inventoryCode"
            ? left.inventoryCode
            : left.biologicalAssetKey;

    const rightValue =
      sortBy === "accountingKey"
        ? right.accountingKey
        : sortBy === "assetType"
          ? right.assetType
          : sortBy === "inventoryCode"
            ? right.inventoryCode
            : right.biologicalAssetKey;

    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "es", { sensitivity: "base" }) * direction;
  });
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canRead = hasPermission(permissions, "forest-biological-asset", "READ");
    const canExport = hasPermission(permissions, "forest-biological-asset", "EXPORT");
    if (!canRead && !canExport) {
      const permissionError = requirePermission(permissions, "forest-biological-asset", "READ");
      if (permissionError) return permissionError;
    }
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx") {
    return fail("Formato inválido", 400);
  }

  const exportMaxLimit = resolveExportMaxLimit();
  const querySchema = z.object({
    level4Id: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(exportMaxLimit).default(100),
    search: z.string().optional(),
    sortBy: z.enum(sortKeys).default("biologicalAssetKey"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  });

  const query = querySchema.safeParse({
    level4Id: req.nextUrl.searchParams.get("level4Id") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? 100,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "biologicalAssetKey",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "asc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { level4Id, limit: requestedLimit, search, sortBy, sortOrder } = query.data;
  const limit = Math.min(requestedLimit, exportMaxLimit);

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const where = {
    level4Id,
    ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
    ...(search?.trim()
      ? {
          OR: [
            { biologicalAssetKey: { contains: search.trim(), mode: "insensitive" as const } },
            { accountingKey: { contains: search.trim(), mode: "insensitive" as const } },
            { geneticMaterialName: { contains: search.trim(), mode: "insensitive" as const } },
            { inventoryCode: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const assets = await prisma.forestBiologicalAssetLevel6.findMany({
    where,
    include: { level4: { select: { code: true, name: true } } },
  });

  const rows = assets.map((asset) => ({
    id: asset.id,
    level4Id: asset.level4Id,
    biologicalAssetKey: asset.biologicalAssetKey,
    accountingKey: asset.accountingKey ?? "",
    assetType: asset.assetType,
    plantingYear: asset.plantingYear,
    inventoryCode: asset.inventoryCode ?? "",
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
  } satisfies ExportRow));

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  const sorted = sortRows(rows, sortBy, sortOrder).slice(0, limit);
  const filenameDate = new Date().toISOString().slice(0, 10);

  const fullHeaders = [
    "ID",
    "Nivel 4 ID",
    "Nivel 4 Código",
    "Nivel 4 Nombre",
    "Clave biológica",
    "Clave contable",
    "Fecha establecimiento",
    "Año plantación",
    "Material genético código",
    "Material genético nombre",
    "Tipo activo",
    "Esquema manejo código",
    "Esquema manejo nombre",
    "Inventario código",
    "Inventario tipo",
    "Fecha inventario",
    "Edad inventario (años)",
    "Unidades nivel 5",
    "Espaciamiento código",
    "Espaciamiento descripción",
    "Distancia entre filas (m)",
    "Distancia entre árboles (m)",
    "Densidad árboles/ha",
    "Sobrevivencia (%)",
    "Altura dominante (m)",
    "Altura media (m)",
    "Diámetro cuadrático (m)",
    "Área basal (m²)",
    "Vol. unit. sin corteza (m³/ha)",
    "Vol. unit. con corteza (m³/ha)",
    "Volumen total sin corteza (m³)",
    "Volumen total con corteza (m³)",
    "Vol. ajustado sin corteza (m³/ha)",
    "Vol. ajustado con corteza (m³/ha)",
    "IMA clase código",
    "IMA clase nombre",
    "Costo real (USD)",
    "Estado",
    "Creado en",
    "Actualizado en",
  ] as const;

  const detailedRows = sorted.map((row) => {
    const asset = assetsById.get(row.id);

    return {
      "ID": row.id,
      "Nivel 4 ID": row.level4Id,
      "Nivel 4 Código": asset?.level4.code ?? "",
      "Nivel 4 Nombre": asset?.level4.name ?? "",
      "Clave biológica": row.biologicalAssetKey,
      "Clave contable": row.accountingKey,
      "Fecha establecimiento": formatDate(asset?.establishmentDate ?? null),
      "Año plantación": row.plantingYear ?? "",
      "Material genético código": asset?.geneticMaterialCode ?? "",
      "Material genético nombre": asset?.geneticMaterialName ?? "",
      "Tipo activo": row.assetType,
      "Esquema manejo código": asset?.managementSchemeCode ?? "",
      "Esquema manejo nombre": asset?.managementSchemeName ?? "",
      "Inventario código": row.inventoryCode,
      "Inventario tipo": asset?.inventoryType ?? "",
      "Fecha inventario": formatDate(asset?.inventoryDate ?? null),
      "Edad inventario (años)": asset?.inventoryAgeYears ?? "",
      "Unidades nivel 5": asset?.level5UnitCount ?? "",
      "Espaciamiento código": asset?.spacingCode ?? "",
      "Espaciamiento descripción": asset?.spacingDescription ?? "",
      "Distancia entre filas (m)": formatNumeric(asset?.spacingBetweenRowsM),
      "Distancia entre árboles (m)": formatNumeric(asset?.spacingBetweenTreesM),
      "Densidad árboles/ha": formatNumeric(asset?.treeDensityPerHa),
      "Sobrevivencia (%)": formatNumeric(asset?.survivalRate),
      "Altura dominante (m)": formatNumeric(asset?.dominantHeightM),
      "Altura media (m)": formatNumeric(asset?.meanHeightM),
      "Diámetro cuadrático (m)": formatNumeric(asset?.quadraticDiameterM),
      "Área basal (m²)": formatNumeric(asset?.basalAreaM2),
      "Vol. unit. sin corteza (m³/ha)": formatNumeric(asset?.unitVolumeM3NoBarkPerHa),
      "Vol. unit. con corteza (m³/ha)": formatNumeric(asset?.unitVolumeM3WithBarkPerHa),
      "Volumen total sin corteza (m³)": formatNumeric(asset?.totalVolumeM3NoBark),
      "Volumen total con corteza (m³)": formatNumeric(asset?.totalVolumeM3WithBark),
      "Vol. ajustado sin corteza (m³/ha)": formatNumeric(asset?.adjustedVolumeM3NoBarkPerHa),
      "Vol. ajustado con corteza (m³/ha)": formatNumeric(asset?.adjustedVolumeM3WithBarkPerHa),
      "IMA clase código": asset?.imaClassCode ?? "",
      "IMA clase nombre": asset?.imaClassName ?? "",
      "Costo real (USD)": formatNumeric(asset?.actualCostUsd),
      "Estado": row.isActive ? "Activo" : "Inactivo",
      "Creado en": row.createdAt,
      "Actualizado en": formatDate(asset?.updatedAt ?? null),
    };
  });

  if (format === "csv") {
    const csv = [
      fullHeaders.join(","),
      ...detailedRows.map((row) => fullHeaders.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activos_biologicos_nivel6_${filenameDate}.csv"`,
      },
    });
  }

  const worksheetRows = detailedRows;

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: [...fullHeaders],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Nivel6");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="activos_biologicos_nivel6_${filenameDate}.xlsx"`,
    },
  });
}
