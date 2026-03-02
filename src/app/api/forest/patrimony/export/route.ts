import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import * as XLSX from "xlsx";

const sortKeys = ["code", "name", "type", "shapeType", "totalAreaHa", "areaM2", "legalStatus", "isActive"] as const;

function resolveExportMaxLimit() {
  const raw = process.env.FOREST_PATRIMONY_EXPORT_MAX_LIMIT;
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

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissions = authResult.session.user.permissions ?? [];
    const canReadPatrimony = hasPermission(permissions, "forest-patrimony", "READ");
    const canReadBiologicalAssets = hasPermission(permissions, "forest-biological-asset", "READ");
    const canWriteBiologicalAssets = ["CREATE", "UPDATE", "DELETE"].some((action) =>
      hasPermission(permissions, "forest-biological-asset", action),
    );

    if (!canReadPatrimony && !canReadBiologicalAssets && !canWriteBiologicalAssets) {
      const permissionError = requirePermission(permissions, "forest-patrimony", "READ");
      if (permissionError) return permissionError;
    }
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx") {
    return fail("Formato inválido", 400);
  }

  const exportMaxLimit = resolveExportMaxLimit();

  const querySchema = z.object({
    level: z.enum(["2", "3", "4", "5"]),
    parentId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(exportMaxLimit).default(100),
    search: z.string().optional(),
    sortBy: z.enum(sortKeys).default("code"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  });

  const query = querySchema.safeParse({
    level: req.nextUrl.searchParams.get("level") ?? "2",
    parentId: req.nextUrl.searchParams.get("parentId") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? 100,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? "code",
    sortOrder: req.nextUrl.searchParams.get("sortOrder") ?? "asc",
  });

  if (!query.success) {
    return fail("Parámetros inválidos", 400, query.error.flatten());
  }

  const { level, parentId, limit: requestedLimit, search, sortBy, sortOrder } = query.data;
  const limit = Math.min(requestedLimit, exportMaxLimit);

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  const filenameDate = new Date().toISOString().slice(0, 10);
  const orderDirection = sortOrder === "asc" ? "asc" : "desc";

  if (level === "2") {
    const where: Prisma.ForestPatrimonyLevel2WhereInput = {
      ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "code"
        ? ({ code: orderDirection } as const)
        : sortBy === "name"
          ? ({ name: orderDirection } as const)
          : sortBy === "type"
            ? ({ type: orderDirection } as const)
            : sortBy === "totalAreaHa"
              ? ({ totalAreaHa: orderDirection } as const)
              : sortBy === "legalStatus"
                ? ({ legalStatus: orderDirection } as const)
                : sortBy === "isActive"
                  ? ({ isActive: orderDirection } as const)
                  : ({ createdAt: "desc" } as const);

    const items = await prisma.forestPatrimonyLevel2.findMany({
      where,
      orderBy,
      take: limit,
    });

    if (format === "csv") {
      const headers = ["code", "name", "type", "totalAreaHa", "legalStatus", "isActive"];
      const csv = [
        headers.join(","),
        ...items.map((item) =>
          [
            item.code,
            item.name,
            item.type,
            item.totalAreaHa,
            item.legalStatus ?? "",
            item.isActive ? "true" : "false",
          ]
            .map(csvEscape)
            .join(","),
        ),
      ].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="patrimonio_nivel2_${filenameDate}.csv"`,
        },
      });
    }

    const rows = items.map((item) => ({
      Código: item.code,
      Nombre: item.name,
      Tipo: item.type,
      "Superficie (ha)": Number(item.totalAreaHa),
      "Estado legal": item.legalStatus ?? "",
      Estatus: item.isActive ? "Activo" : "Inactivo",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Código", "Nombre", "Tipo", "Superficie (ha)", "Estado legal", "Estatus"],
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Nivel2");

    const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
    const safeArray = new Uint8Array(array);
    const body = new Blob([safeArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="patrimonio_nivel2_${filenameDate}.xlsx"`,
      },
    });
  }

  if (!parentId) {
    return fail("parentId es obligatorio para exportar nivel 3, nivel 4 o nivel 5", 400);
  }

  if (level === "5") {
    const where: Prisma.ForestPatrimonyLevel5WhereInput = {
      level4Id: parentId,
      ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "code"
        ? ({ code: orderDirection } as const)
        : sortBy === "name"
          ? ({ name: orderDirection } as const)
          : sortBy === "type"
            ? ({ type: orderDirection } as const)
            : sortBy === "shapeType"
              ? ({ shapeType: orderDirection } as const)
              : sortBy === "areaM2"
                ? ({ areaM2: orderDirection } as const)
                : sortBy === "isActive"
                  ? ({ isActive: orderDirection } as const)
                  : ({ createdAt: "desc" } as const);

    const items = await prisma.forestPatrimonyLevel5.findMany({
      where,
      orderBy,
      take: limit,
    });

    if (format === "csv") {
      const headers = ["code", "name", "type", "shapeType", "areaM2", "isActive"];
      const csv = [
        headers.join(","),
        ...items.map((item) =>
          [item.code, item.name, item.type, item.shapeType, item.areaM2, item.isActive ? "true" : "false"].map(csvEscape).join(","),
        ),
      ].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="patrimonio_nivel5_${filenameDate}.csv"`,
        },
      });
    }

    const rows = items.map((item) => ({
      Código: item.code,
      Nombre: item.name,
      Tipo: item.type,
      Forma: item.shapeType,
      "Area (m2)": Number(item.areaM2),
      Estatus: item.isActive ? "Activo" : "Inactivo",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Código", "Nombre", "Tipo", "Forma", "Area (m2)", "Estatus"],
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Nivel5");

    const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
    const safeArray = new Uint8Array(array);
    const body = new Blob([safeArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="patrimonio_nivel5_${filenameDate}.xlsx"`,
      },
    });
  }

  if (level === "4") {
    const where: Prisma.ForestPatrimonyLevel4WhereInput = {
      level3Id: parentId,
      ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "code"
        ? ({ code: orderDirection } as const)
        : sortBy === "name"
          ? ({ name: orderDirection } as const)
          : sortBy === "type"
            ? ({ type: orderDirection } as const)
            : sortBy === "totalAreaHa"
              ? ({ totalAreaHa: orderDirection } as const)
              : sortBy === "isActive"
                ? ({ isActive: orderDirection } as const)
                : ({ createdAt: "desc" } as const);

    const items = await prisma.forestPatrimonyLevel4.findMany({
      where,
      orderBy,
      take: limit,
    });

    if (format === "csv") {
      const headers = ["code", "name", "type", "totalAreaHa", "isActive"];
      const csv = [
        headers.join(","),
        ...items.map((item) =>
          [item.code, item.name, item.type, item.totalAreaHa, item.isActive ? "true" : "false"].map(csvEscape).join(","),
        ),
      ].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="patrimonio_nivel4_${filenameDate}.csv"`,
        },
      });
    }

    const rows = items.map((item) => ({
      Código: item.code,
      Nombre: item.name,
      Tipo: item.type,
      "Superficie (ha)": Number(item.totalAreaHa),
      "Estado legal": "",
      Estatus: item.isActive ? "Activo" : "Inactivo",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Código", "Nombre", "Tipo", "Superficie (ha)", "Estado legal", "Estatus"],
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Nivel4");

    const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
    const safeArray = new Uint8Array(array);
    const body = new Blob([safeArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="patrimonio_nivel4_${filenameDate}.xlsx"`,
      },
    });
  }

  const where: Prisma.ForestPatrimonyLevel3WhereInput = {
    level2Id: parentId,
    ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sortBy === "code"
      ? ({ code: orderDirection } as const)
      : sortBy === "name"
        ? ({ name: orderDirection } as const)
        : sortBy === "type"
          ? ({ type: orderDirection } as const)
          : sortBy === "totalAreaHa"
            ? ({ totalAreaHa: orderDirection } as const)
            : sortBy === "isActive"
              ? ({ isActive: orderDirection } as const)
              : ({ createdAt: "desc" } as const);

  const items = await prisma.forestPatrimonyLevel3.findMany({
    where,
    orderBy,
    take: limit,
  });

  if (format === "csv") {
    const headers = ["code", "name", "type", "totalAreaHa", "isActive"];
    const csv = [
      headers.join(","),
      ...items.map((item) =>
        [item.code, item.name, item.type, item.totalAreaHa, item.isActive ? "true" : "false"].map(csvEscape).join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="patrimonio_nivel3_${filenameDate}.csv"`,
      },
    });
  }

  const rows = items.map((item) => ({
    Código: item.code,
    Nombre: item.name,
    Tipo: item.type,
    "Superficie (ha)": Number(item.totalAreaHa),
    "Estado legal": "",
    Estatus: item.isActive ? "Activo" : "Inactivo",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["Código", "Nombre", "Tipo", "Superficie (ha)", "Estado legal", "Estatus"],
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Nivel3");

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const safeArray = new Uint8Array(array);
  const body = new Blob([safeArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="patrimonio_nivel3_${filenameDate}.xlsx"`,
    },
  });
}
