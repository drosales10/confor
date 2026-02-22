import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "default-org" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default-org",
      isActive: true,
    },
  });

  const modules = [
    { name: "Authentication", slug: "auth", routePath: "/login", displayOrder: 1 },
    { name: "Users", slug: "users", routePath: "/users", displayOrder: 2 },
    { name: "Dashboard", slug: "dashboard", routePath: "/dashboard", displayOrder: 3 },
    { name: "Organizations", slug: "organizations", routePath: "/organizaciones", displayOrder: 4 },
    {
      name: "Forest Patrimony",
      slug: "forest-patrimony",
      routePath: "/patrimonio-forestal",
      displayOrder: 5,
    },
    {
      name: "Forest Biological Asset",
      slug: "forest-biological-asset",
      routePath: "/activo-biologico",
      displayOrder: 6,
    },
    {
      name: "Forest Configuration",
      slug: "forest-config",
      routePath: "/configuracion-forestal",
      displayOrder: 7,
    },
    { name: "Profile", slug: "profile", routePath: "/profile", displayOrder: 8 },
    { name: "Analytics", slug: "analytics", routePath: "/analytics", displayOrder: 9 },
    { name: "Settings", slug: "settings", routePath: "/settings", displayOrder: 10 },
    { name: "Audit", slug: "audit", routePath: "/audit", displayOrder: 11 },
  ] as const;

  for (const moduleData of modules) {
    await prisma.module.upsert({
      where: { slug: moduleData.slug },
      update: {
        name: moduleData.name,
        routePath: moduleData.routePath,
        isActive: true,
        displayOrder: moduleData.displayOrder,
      },
      create: {
        name: moduleData.name,
        slug: moduleData.slug,
        routePath: moduleData.routePath,
        isActive: true,
        displayOrder: moduleData.displayOrder,
      },
    });
  }

  const actions = ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT", "ADMIN"] as const;
  const allModules = await prisma.module.findMany();

  for (const moduleItem of allModules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: {
          moduleId_action: {
            moduleId: moduleItem.id,
            action,
          },
        },
        update: {
          name: `${moduleItem.name} ${action}`,
        },
        create: {
          moduleId: moduleItem.id,
          action,
          name: `${moduleItem.name} ${action}`,
        },
      });
    }
  }

  const roles = [
    { name: "Super Admin", slug: "SUPER_ADMIN", isSystemRole: true },
    { name: "Admin", slug: "ADMIN", isSystemRole: true },
    { name: "Manager", slug: "MANAGER", isSystemRole: true },
    { name: "User", slug: "USER", isSystemRole: true },
  ] as const;

  const roleRecords: Record<string, string> = {};
  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: roleData.slug,
        },
      },
      update: {
        name: roleData.name,
      },
      create: {
        organizationId: organization.id,
        name: roleData.name,
        slug: roleData.slug,
        isSystemRole: roleData.isSystemRole,
      },
    });
    roleRecords[roleData.slug] = role.id;
  }

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleRecords.SUPER_ADMIN,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: roleRecords.SUPER_ADMIN,
        permissionId: permission.id,
      },
    });
  }

  const adminPasswordHash = await bcrypt.hash("Admin1234", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      status: "ACTIVE",
      passwordHash: adminPasswordHash,
      organizationId: organization.id,
    },
    create: {
      organizationId: organization.id,
      email: "admin@example.com",
      firstName: "System",
      lastName: "Admin",
      displayName: "System Admin",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: roleRecords.SUPER_ADMIN,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      userId: superAdmin.id,
      roleId: roleRecords.SUPER_ADMIN,
      isActive: true,
    },
  });

  const existingConfig = await prisma.systemConfiguration.findFirst({
    where: {
      organizationId: null,
      category: "general",
      key: "site_name",
    },
  });

  if (existingConfig) {
    await prisma.systemConfiguration.update({
      where: { id: existingConfig.id },
      data: { value: "Modular Enterprise App", updatedBy: superAdmin.id },
    });
  } else {
    await prisma.systemConfiguration.create({
      data: {
        organizationId: null,
        category: "general",
        key: "site_name",
        value: "Modular Enterprise App",
        configType: "STRING",
        isPublic: true,
        updatedBy: superAdmin.id,
      },
    });
  }

  console.log("Seed complete");
  console.log("Admin user: admin@example.com / Admin1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
