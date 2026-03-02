import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { fail, requireAuth, requirePermission } from "@/lib/api-helpers";

export const runtime = "nodejs";

type SortKey = "category" | "key" | "configType" | "value" | "updatedAt";

function toSortKey(value: string | null): SortKey {
  if (value === "category" || value === "key" || value === "configType" || value === "value" || value === "updatedAt") {
    return value;
  }
  return "updatedAt";
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const roles = authResult.session.user.roles ?? [];
    const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    if (!isAdmin) {
      const permissionError = requirePermission(authResult.session.user.permissions ?? [], "settings", "EXPORT");
      if (permissionError) return permissionError;
    }

    const organizationId = authResult.session.user.organizationId ?? null;

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 100) || 100, 5000));
    const sortBy = toSortKey(searchParams.get("sortBy"));
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search")?.trim();

    const where = {
      organizationId,
      ...(search
        ? {
            OR: [
              { category: { contains: search, mode: "insensitive" as const } },
              { key: { contains: search, mode: "insensitive" as const } },
              { value: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const items = await prisma.systemConfiguration.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      select: {
        category: true,
        key: true,
        value: true,
        configType: true,
        isPublic: true,
        isEditable: true,
        updatedAt: true,
      },
    });

    const rows = items.map((item) => ({
      Categoría: item.category,
      Clave: item.key,
      Valor: item.value ?? "",
      Tipo: item.configType,
      Público: item.isPublic ? "Sí" : "No",
      Editable: item.isEditable ? "Sí" : "No",
      "Fecha actualización": item.updatedAt.toISOString(),
    }));

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "configuracion");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      return new NextResponse(buffer as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="system_config_${Date.now()}.xlsx"`,
        },
      });
    }

    const headers = ["Categoría", "Clave", "Valor", "Tipo", "Público", "Editable", "Fecha actualización"];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row["Categoría"],
          row["Clave"],
          row["Valor"],
          row["Tipo"],
          row["Público"],
          row["Editable"],
          row["Fecha actualización"],
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="system_config_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible exportar configuración";
    return fail(message, 500);
  }
}
