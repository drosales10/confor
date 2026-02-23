import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function canManageOrganizations(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

function sanitizeFileExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  if (!ext || !/^[a-z0-9]+$/.test(ext)) return "png";
  return ext;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const roles = authResult.session.user.roles ?? [];
  if (!canManageOrganizations(roles)) {
    const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "UPDATE");
    if (permissionError) return permissionError;
  }

  const organizationId = authResult.session.user.organizationId ?? null;
  if (!organizationId) {
    return fail("No hay organización activa", 400);
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof File)) {
    return fail("Archivo inválido", 400);
  }

  const filename = file instanceof File ? file.name : "logo.png";
  const ext = sanitizeFileExtension(filename);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "organizations");
  await fs.mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const outputName = `org-${organizationId}-${Date.now()}.${ext}`;
  const outputPath = path.join(uploadDir, outputName);
  await fs.writeFile(outputPath, buffer);

  const logoUrl = `/uploads/organizations/${outputName}`;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { logoUrl },
  });

  return ok({ logoUrl });
}
