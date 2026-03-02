import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import * as XLSX from "xlsx";
import { z } from "zod";

const sortKeys = ["flag", "name", "rif", "country", "createdAt"] as const;
type SortKey = (typeof sortKeys)[number];

type ExportRow = {
  id: string;
  name: string;
  rif: string;
  countryName: string;
  flag: boolean;
  createdAt: string;
};

function canManageOrganizations(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

function resolveExportMaxLimit() {
  const raw = process.env.ORGANIZATIONS_EXPORT_MAX_LIMIT;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.floor(parsed);
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

    if (sortBy === "flag") {
      return ((left.flag ? 1 : 0) - (right.flag ? 1 : 0)) * direction;
    }

    const leftValue = sortBy === "name" ? left.name : sortBy === "rif" ? left.rif : left.countryName;
    const rightValue = sortBy === "name" ? right.name : sortBy === "rif" ? right.rif : right.countryName;

    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "es", { sensitivity: "base" }) * direction;
  });
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  const isAdmin = canManageOrganizations(roles);
  if (!isAdmin) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "EXPORT");
    if (permissionError) return permissionError;
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

  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    include: { country: true },
  });

  const term = search?.trim().toLowerCase() ?? "";

  const rows = organizations
    .map((org) => ({
      id: org.id,
      name: org.name,
      rif: (org.settings as { rif?: string } | null)?.rif ?? "",
      countryName: org.country?.name ?? "-",
      flag: Boolean(org.country?.flagUrl),
      createdAt: org.createdAt.toISOString(),
    }))
    .filter((row) => {
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        row.rif.toLowerCase().includes(term) ||
        row.countryName.toLowerCase().includes(term)
      );
    });

  const sorted = sortRows(rows, sortBy, sortOrder).slice(0, limit);
  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const headers = ["name", "rif", "country", "flag", "createdAt"];

    const csv = [
      headers.join(","),
      ...sorted.map((row) => [row.name, row.rif, row.countryName, row.flag ? "Sí" : "No", row.createdAt].map(csvEscape).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="organizations_${filenameDate}.csv"`,
      },
    });
  }

  const worksheetRows = sorted.map((row) => ({
    Nombre: row.name,
    RIF: row.rif,
    País: row.countryName,
    Bandera: row.flag ? "Sí" : "No",
    Fecha: row.createdAt,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: ["Nombre", "RIF", "País", "Bandera", "Fecha"],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Organizations");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="organizations_${filenameDate}.xlsx"`,
    },
  });
}
