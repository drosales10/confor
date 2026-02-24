import { ok } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const countries = await prisma.country.findMany({
        orderBy: { name: "asc" },
    });

    return ok({
        items: (countries as any[]).map(c => ({
            id: c.id,
            name: c.name,
            flagUrl: c.flagUrl,
            code: c.code
        }))
    });
}
