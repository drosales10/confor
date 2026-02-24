import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { fail, ok, requireAuth } from "@/lib/api-helpers";
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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const roles = authResult.session.user.roles ?? [];
    if (!canManageOrganizations(roles)) {
        return fail("No tiene permisos para realizar esta acción", 403);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || !(file instanceof File)) {
        return fail("Archivo inválido", 400);
    }

    const ext = sanitizeFileExtension(file.name);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "countries");
    await fs.mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const outputName = `flag-${id}-${Date.now()}.${ext}`;
    const outputPath = path.join(uploadDir, outputName);
    await fs.writeFile(outputPath, buffer);

    const flagUrl = `/uploads/countries/${outputName}`;
    await prisma.country.update({
        where: { id },
        data: { flagUrl } as any,
    });

    return ok({ flagUrl });
}
