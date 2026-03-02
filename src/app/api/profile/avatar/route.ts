import path from "path";
import { promises as fs } from "fs";
import { fail, ok, requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function sanitizeFileExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  if (!ext || !/^[a-z0-9]+$/.test(ext)) return "png";
  return ext;
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof File)) {
    return fail("Archivo inválido", 400);
  }

  const ext = sanitizeFileExtension(file.name);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "users");
  await fs.mkdir(uploadDir, { recursive: true });

  const userId = authResult.session.user.id;
  const buffer = Buffer.from(await file.arrayBuffer());
  const outputName = `user-${userId}-${Date.now()}.${ext}`;
  const outputPath = path.join(uploadDir, outputName);
  await fs.writeFile(outputPath, buffer);

  const avatarUrl = `/uploads/users/${outputName}`;
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

  return ok({ avatarUrl });
}

export async function DELETE() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const userId = authResult.session.user.id;
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });

  return ok({ avatarUrl: null });
}
