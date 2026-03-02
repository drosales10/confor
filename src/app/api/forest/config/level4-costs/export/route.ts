import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const sortKeys = ["code", "plantationAreaHa", "rotationPhase", "isActive", "createdAt", "updatedAt"] as const;
type SortKey = (typeof sortKeys)[number];

type ExportRow = {
  id: string;
  level4Id: string;
  level4Code: string;
  level4Name: string;
  code: string;
  plantationAreaHa: string;
  rotationPhase: string;
  accountingDocumentId: string;
  accountingDocumentCode: string;
  accountingDocumentNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

function decimalToString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
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

    if (sortBy === "plantationAreaHa") {
      return (Number(left.plantationAreaHa || 0) - Number(right.plantationAreaHa || 0)) * direction;
    }

    if (sortBy === "rotationPhase") {
      return String(left.rotationPhase ?? "").localeCompare(String(right.rotationPhase ?? ""), "es", { sensitivity: "base" }) * direction;
    }

    return String(left.code ?? "").localeCompare(String(right.code ?? ""), "es", { sensitivity: "base" }) * direction;
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

  const and: Prisma.Level4AdministrativeCostWhereInput[] = [];

  if (search?.trim()) {
    and.push({
      OR: [
        { code: { contains: search.trim(), mode: "insensitive" as const } },
        { rotationPhase: { contains: search.trim(), mode: "insensitive" as const } },
        { level4: { code: { contains: search.trim(), mode: "insensitive" as const } } },
        { level4: { name: { contains: search.trim(), mode: "insensitive" as const } } },
      ],
    });
  }

  if (!isSuperAdmin) {
    and.push({
      level4: {
        level3: {
          level2: {
            organizationId: organizationId ?? "",
          },
        },
      },
    });
  }

  const where = and.length ? { AND: and } : {};

  const costs = await prisma.level4AdministrativeCost.findMany({
    where,
    include: {
      level4: { select: { id: true, code: true, name: true } },
      accountingDocument: { select: { id: true, code: true, documentNumber: true } },
    },
  });

  const rows = costs.map((item) => ({
    id: item.id,
    level4Id: item.level4Id,
    level4Code: item.level4?.code ?? "",
    level4Name: item.level4?.name ?? "",
    code: item.code,
    plantationAreaHa: decimalToString(item.plantationAreaHa),
    rotationPhase: item.rotationPhase ?? "",
    accountingDocumentId: item.accountingDocumentId ?? "",
    accountingDocumentCode: item.accountingDocument?.code ?? "",
    accountingDocumentNumber: item.accountingDocument?.documentNumber ?? "",
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  } satisfies ExportRow));

  const sorted = sortRows(rows, sortBy, sortOrder).slice(0, limit);
  const filenameDate = new Date().toISOString().slice(0, 10);

  const headers = [
    "id",
    "level4Id",
    "level4Code",
    "level4Name",
    "code",
    "plantationAreaHa",
    "rotationPhase",
    "accountingDocumentId",
    "accountingDocumentCode",
    "accountingDocumentNumber",
    "isActive",
    "createdAt",
    "updatedAt",
  ];

  if (format === "csv") {
    const csv = [
      headers.join(","),
      ...sorted.map((row) =>
        [
          row.id,
          row.level4Id,
          row.level4Code,
          row.level4Name,
          row.code,
          row.plantationAreaHa,
          row.rotationPhase,
          row.accountingDocumentId,
          row.accountingDocumentCode,
          row.accountingDocumentNumber,
          row.isActive ? "true" : "false",
          row.createdAt,
          row.updatedAt,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="level4_costs_${filenameDate}.csv"`,
      },
    });
  }

  const worksheetRows = sorted.map((row) => ({
    ID: row.id,
    "Nivel 4 ID": row.level4Id,
    "Nivel 4 Código": row.level4Code,
    "Nivel 4 Nombre": row.level4Name,
    Código: row.code,
    "Área plantación (ha)": row.plantationAreaHa,
    "Fase rotación": row.rotationPhase,
    "Documento ID": row.accountingDocumentId,
    "Documento Código": row.accountingDocumentCode,
    "Documento Número": row.accountingDocumentNumber,
    Activo: row.isActive ? "Sí" : "No",
    "Creado en": row.createdAt,
    "Actualizado en": row.updatedAt,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: [
      "ID",
      "Nivel 4 ID",
      "Nivel 4 Código",
      "Nivel 4 Nombre",
      "Código",
      "Área plantación (ha)",
      "Fase rotación",
      "Documento ID",
      "Documento Código",
      "Documento Número",
      "Activo",
      "Creado en",
      "Actualizado en",
    ],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Level4Costs");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="level4_costs_${filenameDate}.xlsx"`,
    },
  });
}
