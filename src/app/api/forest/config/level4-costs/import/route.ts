import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { level4AdministrativeCostCreateSchema } from "@/validations/forest-config.schema";

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
  if (!normalized) return undefined;
  if (["1", "true", "si", "sí", "yes", "activo", "activa"].includes(normalized)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(normalized)) return false;
  return undefined;
}

function parseNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type ImportRow = {
  id?: string;
  level4Id?: string;
  level4Code?: string;
  code: string;
  plantationAreaHa: number | null;
  rotationPhase?: string;
  accountingDocumentId?: string;
  accountingDocumentCode?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

async function resolveLevel4Id(row: ImportRow, organizationId: string | null, isSuperAdmin: boolean) {
  if (row.level4Id) {
    const level4 = await prisma.forestPatrimonyLevel4.findFirst({
      where: {
        id: row.level4Id,
        ...(!isSuperAdmin
          ? {
              level3: {
                level2: {
                  organizationId: organizationId ?? "",
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return level4?.id ?? null;
  }

  if (row.level4Code) {
    const level4 = await prisma.forestPatrimonyLevel4.findFirst({
      where: {
        code: row.level4Code,
        ...(!isSuperAdmin
          ? {
              level3: {
                level2: {
                  organizationId: organizationId ?? "",
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return level4?.id ?? null;
  }

  return null;
}

async function resolveAccountingDocumentId(row: ImportRow) {
  if (row.accountingDocumentId) {
    const doc = await prisma.accountingDocument.findUnique({
      where: { id: row.accountingDocumentId },
      select: { id: true },
    });
    return doc?.id ?? null;
  }

  if (row.accountingDocumentCode) {
    const doc = await prisma.accountingDocument.findFirst({
      where: { code: row.accountingDocumentCode },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return doc?.id ?? null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const permissions = authResult.session.user.permissions ?? [];
  const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");

  if (!isSuperAdmin) {
    const canCreate = hasPermission(permissions, "forest-config", "CREATE");
    const canUpdate = hasPermission(permissions, "forest-config", "UPDATE");
    if (!canCreate && !canUpdate) {
      const permissionError = requirePermission(permissions, "forest-config", "CREATE");
      if (permissionError) return permissionError;
    }
  }

  const currentOrganizationId = await resolveOrganizationId({
    id: authResult.session.user.id,
    organizationId: authResult.session.user.organizationId,
  });

  if (!isSuperAdmin && !currentOrganizationId) {
    return fail("El usuario no tiene una organización asociada", 403);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return fail("Archivo requerido", 400);
  }

  const filename = file.name ?? "";
  const ext = filename.toLowerCase().endsWith(".xlsx") ? "xlsx" : filename.toLowerCase().endsWith(".csv") ? "csv" : null;
  if (!ext) {
    return fail("Formato inválido", 400);
  }

  let rows: ImportRow[] = [];

  if (ext === "csv") {
    const content = await file.text();
    const parsed = parseCsv(content);

    const headerIndex = new Map<string, number>();
    parsed.headers.forEach((header, idx) => headerIndex.set(normalizeHeader(header), idx));

    const required = ["code", "plantationareaha"];
    for (const key of required) {
      if (!headerIndex.has(key)) {
        return fail(`Falta columna obligatoria: ${key}`, 400);
      }
    }

    rows = parsed.rows
      .map((cols) => {
        const get = (key: string) => {
          const idx = headerIndex.get(key);
          return idx === undefined ? "" : String(cols[idx] ?? "").trim();
        };

        return {
          id: get("id") || undefined,
          level4Id: get("level4id") || undefined,
          level4Code: get("level4code") || undefined,
          code: get("code"),
          plantationAreaHa: parseNumber(get("plantationareaha")),
          rotationPhase: get("rotationphase") || undefined,
          accountingDocumentId: get("accountingdocumentid") || undefined,
          accountingDocumentCode: get("accountingdocumentcode") || undefined,
          isActive: parseBoolean(get("isactive")),
          createdAt: get("createdat") || undefined,
          updatedAt: get("updatedat") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || row.plantationAreaHa !== null);
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

    rows = jsonRows
      .map((record) => {
        const get = (target: string) => {
          const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === target);
          const value = matchKey ? record[matchKey] : "";
          return String(value ?? "").trim();
        };

        return {
          id: get("id") || undefined,
          level4Id: get("level4id") || undefined,
          level4Code: get("level4code") || undefined,
          code: get("code"),
          plantationAreaHa: parseNumber(get("plantationareaha")),
          rotationPhase: get("rotationphase") || undefined,
          accountingDocumentId: get("accountingdocumentid") || undefined,
          accountingDocumentCode: get("accountingdocumentcode") || undefined,
          isActive: parseBoolean(get("isactive")),
          createdAt: get("createdat") || undefined,
          updatedAt: get("updatedat") || undefined,
        } satisfies ImportRow;
      })
      .filter((row) => Boolean(row.code) || row.plantationAreaHa !== null);
  }

  if (rows.length === 0) {
    return fail("El archivo no contiene registros", 400);
  }

  const errors: Array<{ row: number; code?: string; error: string }> = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    const level4Id = await resolveLevel4Id(row, currentOrganizationId ?? null, Boolean(isSuperAdmin));
    if (!level4Id) {
      errors.push({ row: rowNumber, code: row.code, error: "Unidad administrativa nivel 4 no encontrada" });
      skipped++;
      continue;
    }

    const accountingDocumentId = await resolveAccountingDocumentId(row);
    if ((row.accountingDocumentId || row.accountingDocumentCode) && !accountingDocumentId) {
      errors.push({ row: rowNumber, code: row.code, error: "Documento contable no encontrado" });
      skipped++;
      continue;
    }

    const payload = {
      level4Id,
      code: row.code,
      plantationAreaHa: row.plantationAreaHa,
      rotationPhase: row.rotationPhase ?? null,
      accountingDocumentId: accountingDocumentId ?? null,
      isActive: row.isActive ?? true,
    };

    const parsed = level4AdministrativeCostCreateSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({ row: rowNumber, code: row.code, error: "Datos inválidos" });
      skipped++;
      continue;
    }

    try {
      const existing = row.id
        ? await prisma.level4AdministrativeCost.findFirst({
            where: {
              id: row.id,
              ...(isSuperAdmin
                ? {}
                : {
                    level4: {
                      level3: {
                        level2: {
                          organizationId: currentOrganizationId ?? "",
                        },
                      },
                    },
                  }),
            },
          })
        : await prisma.level4AdministrativeCost.findFirst({
            where: {
              level4Id: parsed.data.level4Id,
              code: parsed.data.code,
              ...(isSuperAdmin
                ? {}
                : {
                    level4: {
                      level3: {
                        level2: {
                          organizationId: currentOrganizationId ?? "",
                        },
                      },
                    },
                  }),
            },
          });

      if (existing) {
        await prisma.level4AdministrativeCost.update({
          where: { id: existing.id },
          data: {
            level4Id: parsed.data.level4Id,
            code: parsed.data.code,
            plantationAreaHa: parsed.data.plantationAreaHa,
            rotationPhase: parsed.data.rotationPhase,
            accountingDocumentId: parsed.data.accountingDocumentId,
            isActive: parsed.data.isActive ?? existing.isActive,
          },
        });
        updated++;
        continue;
      }

      await prisma.level4AdministrativeCost.create({
        data: {
          level4Id: parsed.data.level4Id,
          code: parsed.data.code,
          plantationAreaHa: parsed.data.plantationAreaHa,
          rotationPhase: parsed.data.rotationPhase,
          accountingDocumentId: parsed.data.accountingDocumentId,
          isActive: parsed.data.isActive ?? true,
        },
      });
      created++;
    } catch (err) {
      errors.push({ row: rowNumber, code: row.code, error: err instanceof Error ? err.message : "No fue posible importar" });
      skipped++;
    }
  }

  return ok({ created, updated, skipped, errors });
}
