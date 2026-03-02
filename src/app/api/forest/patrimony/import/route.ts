import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import * as XLSX from "xlsx";

type Level2Type = "FINCA" | "PREDIO" | "HATO" | "FUNDO" | "HACIENDA";
type LegalStatus = "ADQUISICION" | "ARRIENDO" | "USUFRUCTO" | "COMODATO";
type Level3Type = "COMPARTIMIENTO" | "BLOCK" | "SECCION" | "LOTE" | "ZONA" | "BLOQUE";
type Level4Type = "RODAL" | "PARCELA" | "ENUMERATION" | "UNIDAD_DE_MANEJO";
type Level5Type = "REFERENCIA" | "SUBUNIDAD" | "SUBPARCELA" | "MUESTRA" | "SUBMUESTRA";
type PlotShapeType = "RECTANGULAR" | "CUADRADA" | "CIRCULAR" | "HEXAGONAL";

type ImportRow = {
  code: string;
  name: string;
  type: Level2Type;
  totalAreaHa: number;
  legalStatus?: LegalStatus;
  isActive?: boolean;
};

type ImportLevel3Row = {
  code: string;
  name: string;
  type: Level3Type;
  totalAreaHa: number;
  isActive?: boolean;
};

type ImportLevel4Row = {
  code: string;
  name: string;
  type: Level4Type;
  totalAreaHa: number;
  isActive?: boolean;
};

type ImportLevel5Row = {
  code: string;
  name: string;
  type: Level5Type;
  shapeType: PlotShapeType;
  areaM2: number;
  isActive?: boolean;
};

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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          current += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === ",") {
      result.push(current);
      current = "";
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r\n|\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "si", "sí", "activo"].includes(normalized)) return true;
  if (["false", "0", "no", "inactivo"].includes(normalized)) return false;
  return undefined;
}

function parseNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseType(value: string): Level2Type | null {
  const normalized = value.trim().toUpperCase();
  if (["FINCA", "PREDIO", "HATO", "FUNDO", "HACIENDA"].includes(normalized)) {
    return normalized as Level2Type;
  }
  return null;
}

function parseLevel3Type(value: string): Level3Type | null {
  const normalized = value.trim().toUpperCase();
  if (["COMPARTIMIENTO", "BLOCK", "SECCION", "LOTE", "ZONA", "BLOQUE"].includes(normalized)) {
    return normalized as Level3Type;
  }
  return null;
}

function parseLevel4Type(value: string): Level4Type | null {
  const normalized = value.trim().toUpperCase();
  if (["RODAL", "PARCELA", "ENUMERATION", "UNIDAD_DE_MANEJO"].includes(normalized)) {
    return normalized as Level4Type;
  }
  return null;
}

function parseLevel5Type(value: string): Level5Type | null {
  const normalized = value.trim().toUpperCase();
  if (["REFERENCIA", "SUBUNIDAD", "SUBPARCELA", "MUESTRA", "SUBMUESTRA"].includes(normalized)) {
    return normalized as Level5Type;
  }
  return null;
}

function parseShapeType(value: string): PlotShapeType | null {
  const normalized = value.trim().toUpperCase();
  if (["RECTANGULAR", "CUADRADA", "CIRCULAR", "HEXAGONAL"].includes(normalized)) {
    return normalized as PlotShapeType;
  }
  return null;
}

function parseLegalStatus(value: string): LegalStatus | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (["ADQUISICION", "ARRIENDO", "USUFRUCTO", "COMODATO"].includes(normalized)) {
    return normalized as LegalStatus;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
  if (!isSuperAdmin) {
    const permissions = authResult.session.user.permissions ?? [];
    const canCreatePatrimony = hasPermission(permissions, "forest-patrimony", "CREATE");
    const canWriteBiologicalAssets = ["CREATE", "UPDATE", "DELETE"].some((action) =>
      hasPermission(permissions, "forest-biological-asset", action),
    );

    if (!canCreatePatrimony && !canWriteBiologicalAssets) {
      const permissionError = requirePermission(permissions, "forest-patrimony", "CREATE");
      if (permissionError) return permissionError;
    }
  }

  const organizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !organizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const level = formData?.get("level");
  const parentId = formData?.get("parentId");

  if (!file || !(file instanceof File)) {
    return fail("Archivo requerido", 400);
  }

  if (level !== "2" && level !== "3" && level !== "4" && level !== "5") {
    return fail("Solo se permite importación de nivel 2, nivel 3, nivel 4 o nivel 5", 400);
  }

  if ((level === "3" || level === "4" || level === "5") && (typeof parentId !== "string" || !parentId.trim())) {
    return fail("parentId es obligatorio para importar nivel 3, nivel 4 o nivel 5", 400);
  }

  if (level === "3") {
    const parent = await prisma.forestPatrimonyLevel2.findFirst({
      where: {
        id: parentId as string,
        ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
      },
      select: { id: true },
    });

    if (!parent) {
      return fail("Nivel 2 padre no encontrado", 404);
    }
  }

  if (level === "4") {
    const parent = await prisma.forestPatrimonyLevel3.findFirst({
      where: {
        id: parentId as string,
        ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
      },
      select: { id: true },
    });

    if (!parent) {
      return fail("Nivel 3 padre no encontrado", 404);
    }
  }

  if (level === "5") {
    const parent = await prisma.forestPatrimonyLevel4.findFirst({
      where: {
        id: parentId as string,
        ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
      },
      select: { id: true },
    });

    if (!parent) {
      return fail("Nivel 4 padre no encontrado", 404);
    }
  }

  const filename = file.name ?? "";
  const ext = filename.toLowerCase().endsWith(".xlsx") ? "xlsx" : filename.toLowerCase().endsWith(".csv") ? "csv" : null;
  if (!ext) {
    return fail("Formato inválido", 400);
  }

  let rows: ImportRow[] = [];
  let level3Rows: ImportLevel3Row[] = [];
  let level4Rows: ImportLevel4Row[] = [];
  let level5Rows: ImportLevel5Row[] = [];

  if (ext === "csv") {
    const content = await file.text();
    const parsed = parseCsv(content);

    const headerIndex = new Map<string, number>();
    parsed.headers.forEach((header, index) => headerIndex.set(normalizeHeader(header), index));

    const required = level === "5" ? ["code", "name", "type", "shapetype", "aream2"] : ["code", "name", "type", "totalareaha"];
    for (const key of required) {
      if (!headerIndex.has(key)) {
        return fail(`Falta columna obligatoria: ${key}`, 400);
      }
    }

    if (level === "2") {
      rows = parsed.rows
        .map((cols) => {
          const get = (key: string) => {
            const index = headerIndex.get(key);
            return index === undefined ? "" : String(cols[index] ?? "").trim();
          };

          const type = parseType(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "FINCA",
            totalAreaHa,
            legalStatus: parseLegalStatus(get("legalstatus")),
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportRow;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else if (level === "3") {
      level3Rows = parsed.rows
        .map((cols) => {
          const get = (key: string) => {
            const index = headerIndex.get(key);
            return index === undefined ? "" : String(cols[index] ?? "").trim();
          };

          const type = parseLevel3Type(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "LOTE",
            totalAreaHa,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel3Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else if (level === "4") {
      level4Rows = parsed.rows
        .map((cols) => {
          const get = (key: string) => {
            const index = headerIndex.get(key);
            return index === undefined ? "" : String(cols[index] ?? "").trim();
          };

          const type = parseLevel4Type(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "RODAL",
            totalAreaHa,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel4Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else {
      level5Rows = parsed.rows
        .map((cols) => {
          const get = (key: string) => {
            const index = headerIndex.get(key);
            return index === undefined ? "" : String(cols[index] ?? "").trim();
          };

          const type = parseLevel5Type(get("type"));
          const shapeType = parseShapeType(get("shapetype"));
          const areaM2 = parseNumber(get("aream2"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "SUBUNIDAD",
            shapeType: shapeType ?? "RECTANGULAR",
            areaM2,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel5Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    }
  }

  if (ext === "xlsx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!worksheet) {
      return fail("El archivo no contiene hojas", 400);
    }

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    if (level === "2") {
      rows = jsonRows
        .map((record) => {
          const get = (target: string) => {
            const key = Object.keys(record).find((item) => normalizeHeader(item) === target);
            const value = key ? record[key] : "";
            return String(value ?? "").trim();
          };

          const type = parseType(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "FINCA",
            totalAreaHa,
            legalStatus: parseLegalStatus(get("legalstatus")),
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportRow;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else if (level === "3") {
      level3Rows = jsonRows
        .map((record) => {
          const get = (target: string) => {
            const key = Object.keys(record).find((item) => normalizeHeader(item) === target);
            const value = key ? record[key] : "";
            return String(value ?? "").trim();
          };

          const type = parseLevel3Type(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "LOTE",
            totalAreaHa,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel3Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else if (level === "4") {
      level4Rows = jsonRows
        .map((record) => {
          const get = (target: string) => {
            const key = Object.keys(record).find((item) => normalizeHeader(item) === target);
            const value = key ? record[key] : "";
            return String(value ?? "").trim();
          };

          const type = parseLevel4Type(get("type"));
          const totalAreaHa = parseNumber(get("totalareaha"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "RODAL",
            totalAreaHa,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel4Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    } else {
      level5Rows = jsonRows
        .map((record) => {
          const get = (target: string) => {
            const key = Object.keys(record).find((item) => normalizeHeader(item) === target);
            const value = key ? record[key] : "";
            return String(value ?? "").trim();
          };

          const type = parseLevel5Type(get("type"));
          const shapeType = parseShapeType(get("shapetype"));
          const areaM2 = parseNumber(get("aream2"));

          return {
            code: get("code"),
            name: get("name"),
            type: type ?? "SUBUNIDAD",
            shapeType: shapeType ?? "RECTANGULAR",
            areaM2,
            isActive: parseBoolean(get("isactive")),
          } satisfies ImportLevel5Row;
        })
        .filter((row) => Boolean(row.code) || Boolean(row.name));
    }
  }

  if (level === "2" && rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  if (level === "3" && level3Rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  if (level === "4" && level4Rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  if (level === "5" && level5Rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; code?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const rowsToProcess = level === "2" ? rows : level === "3" ? level3Rows : level === "4" ? level4Rows : level5Rows;

  for (let index = 0; index < rowsToProcess.length; index++) {
    const rowNumber = index + 2;
    const row = rowsToProcess[index];

    if (!row.code.trim() || !row.name.trim()) {
      errors.push({ row: rowNumber, code: row.code, error: "Código y nombre son obligatorios" });
      skipped++;
      continue;
    }

    if (level !== "5") {
      const areaRow = row as ImportRow | ImportLevel3Row | ImportLevel4Row;
      if (!Number.isFinite(areaRow.totalAreaHa) || areaRow.totalAreaHa < 0) {
        errors.push({ row: rowNumber, code: row.code, error: "Superficie inválida" });
        skipped++;
        continue;
      }
    }

    try {
      if (level === "2") {
        const level2Row = row as ImportRow;
        const where: Prisma.ForestPatrimonyLevel2WhereInput = {
          code: level2Row.code,
          ...(!isSuperAdmin ? { organizationId: organizationId ?? "" } : {}),
        };

        const existing = await prisma.forestPatrimonyLevel2.findFirst({ where });

        if (existing) {
          await prisma.forestPatrimonyLevel2.update({
            where: { id: existing.id },
            data: {
              name: level2Row.name,
              type: level2Row.type,
              totalAreaHa: level2Row.totalAreaHa,
              legalStatus: level2Row.legalStatus,
              isActive: level2Row.isActive ?? existing.isActive,
            },
          });

          updated++;
          continue;
        }

        await prisma.forestPatrimonyLevel2.create({
          data: {
            code: level2Row.code,
            name: level2Row.name,
            type: level2Row.type,
            totalAreaHa: level2Row.totalAreaHa,
            legalStatus: level2Row.legalStatus,
            isActive: level2Row.isActive ?? true,
            ...(!isSuperAdmin ? { organizationId: organizationId ?? undefined } : {}),
          },
        });
      } else if (level === "3") {
        const level3Row = row as ImportLevel3Row;

        const existing = await prisma.forestPatrimonyLevel3.findFirst({
          where: {
            level2Id: parentId as string,
            code: level3Row.code,
            ...(!isSuperAdmin ? { level2: { organizationId: organizationId ?? "" } } : {}),
          },
        });

        if (existing) {
          await prisma.forestPatrimonyLevel3.update({
            where: { id: existing.id },
            data: {
              name: level3Row.name,
              type: level3Row.type,
              totalAreaHa: level3Row.totalAreaHa,
              isActive: level3Row.isActive ?? existing.isActive,
            },
          });

          updated++;
          continue;
        }

        await prisma.forestPatrimonyLevel3.create({
          data: {
            level2Id: parentId as string,
            code: level3Row.code,
            name: level3Row.name,
            type: level3Row.type,
            totalAreaHa: level3Row.totalAreaHa,
            isActive: level3Row.isActive ?? true,
          },
        });
      } else if (level === "4") {
        const level4Row = row as ImportLevel4Row;

        const existing = await prisma.forestPatrimonyLevel4.findFirst({
          where: {
            level3Id: parentId as string,
            code: level4Row.code,
            ...(!isSuperAdmin ? { level3: { level2: { organizationId: organizationId ?? "" } } } : {}),
          },
        });

        if (existing) {
          await prisma.forestPatrimonyLevel4.update({
            where: { id: existing.id },
            data: {
              name: level4Row.name,
              type: level4Row.type,
              totalAreaHa: level4Row.totalAreaHa,
              isActive: level4Row.isActive ?? existing.isActive,
            },
          });

          updated++;
          continue;
        }

        await prisma.forestPatrimonyLevel4.create({
          data: {
            level3Id: parentId as string,
            code: level4Row.code,
            name: level4Row.name,
            type: level4Row.type,
            totalAreaHa: level4Row.totalAreaHa,
            isActive: level4Row.isActive ?? true,
          },
        });
      } else {
        const level5Row = row as ImportLevel5Row;

        if (!Number.isFinite(level5Row.areaM2) || level5Row.areaM2 <= 0) {
          errors.push({ row: rowNumber, code: level5Row.code, error: "Área inválida para nivel 5" });
          skipped++;
          continue;
        }

        const existing = await prisma.forestPatrimonyLevel5.findFirst({
          where: {
            level4Id: parentId as string,
            code: level5Row.code,
            ...(!isSuperAdmin ? { level4: { level3: { level2: { organizationId: organizationId ?? "" } } } } : {}),
          },
        });

        if (existing) {
          await prisma.forestPatrimonyLevel5.update({
            where: { id: existing.id },
            data: {
              name: level5Row.name,
              type: level5Row.type,
              shapeType: level5Row.shapeType,
              areaM2: level5Row.areaM2,
              isActive: level5Row.isActive ?? existing.isActive,
            },
          });

          updated++;
          continue;
        }

        await prisma.forestPatrimonyLevel5.create({
          data: {
            level4Id: parentId as string,
            code: level5Row.code,
            name: level5Row.name,
            type: level5Row.type,
            shapeType: level5Row.shapeType,
            areaM2: level5Row.areaM2,
            isActive: level5Row.isActive ?? true,
          },
        });
      }

      created++;
    } catch (err) {
      errors.push({ row: rowNumber, code: row.code, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
