import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, requirePermission, fail } from "@/lib/api-helpers";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const permissionError = requirePermission(authResult.session.user.permissions, "audit", "DELETE");
    if (permissionError) return permissionError;

    const resolvedParams = await params;

    if (!resolvedParams?.id) {
        return fail("ID is required", 400);
    }

    try {
        await prisma.auditLog.delete({
            where: { id: resolvedParams.id },
        });

        return ok({ success: true });
    } catch (error) {
        return fail("Audit log not found or cannot be deleted", 404);
    }
}
