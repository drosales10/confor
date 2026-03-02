import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const sortKeys = ["code", "scientificName", "commonName", "genus", "family", "taxonomicOrder", "isActive", "createdAt", "updatedAt"] as const;
type SortKey = (typeof sortKeys)[number];

type ExportRow = {
  id: string;
  code: string;
  scientificName: string;
  commonName: string;
  genus: string;
  family: string;
  taxonomicOrder: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  organizationName: string;
};

function resolveExportMaxLimit() {
  const raw = process.env.FOREST_CONFIG_EXPORT_MAX_LIMIT;
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

function sortRows(rows: ExportRow[], sortBy: SortKey, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    if (sortBy === "createdAt") {
      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    }

    if (sortBy === "updatedAt") {
      return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction;
    }

    if (sortBy === "isActive") {
      return ((left.isActive ? 1 : 0) - (right.isActive ? 1 : 0)) * direction;
    }

    const leftValue = left[sortBy] ?? "";
    const rightValue = right[sortBy] ?? "";

    return String(leftValue).localeCompare(String(rightValue), "es", { sensitivity: "base" }) * direction;
  });
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canRead = hasPermission(permissions, "forest-config", "READ");
    const canExport = hasPermission(permissions, "forest-config", "EXPORT");
    if (!canRead && !canExport) {
      const permissionError = requirePermission(permissions, "forest-config", "READ");
      if (permissionError) return permissionError;
    }
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx") {
    return fail("Formato inválido", 400);
  }

  const exportMaxLimit = resolveExportMaxLimit();
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(exportMaxLimit).default(100),
    search: z.string().optional(),
    sortBy: z.enum(sortKeys).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });

  const query = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? 100,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "createdAt",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "desc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { limit: requestedLimit, search, sortBy, sortOrder } = query.data;
  const limit = Math.min(requestedLimit, exportMaxLimit);

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const where = {
    ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
    ...(search?.trim()
      ? {
          OR: [
            { code: { contains: search.trim(), mode: "insensitive" as const } },
            { scientificName: { contains: search.trim(), mode: "insensitive" as const } },
            { commonName: { contains: search.trim(), mode: "insensitive" as const } },
            { genus: { contains: search.trim(), mode: "insensitive" as const } },
            { family: { contains: search.trim(), mode: "insensitive" as const } },
            { taxonomicOrder: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const species = await prisma.species.findMany({
    where,
    include: {
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  const rows = species.map((item) => ({
    id: item.id,
    code: item.code,
    scientificName: item.scientificName,
    commonName: item.commonName ?? "",
    genus: item.genus ?? "",
    family: item.family ?? "",
    taxonomicOrder: item.taxonomicOrder ?? "",
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    organizationId: item.organizationId ?? "",
    organizationName: item.organization?.name ?? "",
  } satisfies ExportRow));

  const sorted = sortRows(rows, sortBy, sortOrder).slice(0, limit);
  const filenameDate = new Date().toISOString().slice(0, 10);

  const headers = [
    "id",
    "code",
    "scientificName",
    "commonName",
    "genus",
    "family",
    "taxonomicOrder",
    "isActive",
    "createdAt",
    "updatedAt",
    "organizationId",
    "organizationName",
  ];

  if (format === "csv") {
    const csv = [
      headers.join(","),
      ...sorted.map((row) =>
        [
          row.id,
          row.code,
          row.scientificName,
          row.commonName,
          row.genus,
          row.family,
          row.taxonomicOrder,
          row.isActive ? "true" : "false",
          row.createdAt,
          row.updatedAt,
          row.organizationId,
          row.organizationName,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="species_${filenameDate}.csv"`,
      },
    });
  }

  const worksheetRows = sorted.map((row) => ({
    ID: row.id,
    Código: row.code,
    "Nombre científico": row.scientificName,
    "Nombre común": row.commonName,
    Género: row.genus,
    Familia: row.family,
    "Orden taxonómico": row.taxonomicOrder,
    Activo: row.isActive ? "Sí" : "No",
    "Creado en": row.createdAt,
    "Actualizado en": row.updatedAt,
    "Organización ID": row.organizationId,
    Organización: row.organizationName,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: [
      "ID",
      "Código",
      "Nombre científico",
      "Nombre común",
      "Género",
      "Familia",
      "Orden taxonómico",
      "Activo",
      "Creado en",
      "Actualizado en",
      "Organización ID",
      "Organización",
    ],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Species");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="species_${filenameDate}.xlsx"`,
    },
  });
}
