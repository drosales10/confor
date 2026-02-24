import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, requireAuth, requirePermission } from "@/lib/api-helpers";
import { createOrganizationSchema } from "@/validations/organization.schema";

function canManageOrganizations(roles: string[]) {
    return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const roles = authResult.session.user.roles ?? [];
    if (!canManageOrganizations(roles)) {
        const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "UPDATE");
        if (permissionError) return permissionError;
    }

    const body = await req.json();
    const parsed = createOrganizationSchema.partial().safeParse(body);
    if (!parsed.success) {
        return fail("Datos inválidos", 400, parsed.error.flatten());
    }

    try {
        const updated = await prisma.organization.update({
            where: { id },
            data: {
                ...(parsed.data.name && { name: parsed.data.name }),
                ...(parsed.data.countryId !== undefined && { countryId: parsed.data.countryId || null }),
                ...(parsed.data.rif && { settings: { rif: parsed.data.rif } }),
            } as any,
        });

        return ok({
            id: updated.id,
            name: updated.name,
            rif: (updated.settings as { rif?: string } | null)?.rif,
            countryId: (updated as any).countryId,
        });
    } catch (error) {
        return fail("No se pudo actualizar la organización", 500);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const roles = authResult.session.user.roles ?? [];
    if (!canManageOrganizations(roles)) {
        const permissionError = requirePermission(authResult.session.user.permissions ?? [], "organizations", "DELETE");
        if (permissionError) return permissionError;
    }

    try {
        await prisma.organization.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return ok({ message: "Organización eliminada correctamente" });
    } catch (error) {
        return fail("No se pudo eliminar la organización", 500);
    }
}
