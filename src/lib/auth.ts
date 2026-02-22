import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/crypto";
import { getUserRolesAndPermissions } from "@/lib/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });
        if (!user?.passwordHash) {
          return null;
        }

        if (user.status !== "ACTIVE") {
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null,
            },
          });

          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: "LOGIN_FAILED",
              entityType: "User",
              entityId: user.id,
            },
          });

          return null;
        }

        const roleInfo = await getUserRolesAndPermissions(user.id);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lastLoginAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          roles: roleInfo.roles,
          permissions: roleInfo.permissions,
          organizationId: user.organizationId ?? null,
          organizationName: user.organization?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.organizationId = user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.roles = token.roles ?? [];
        session.user.permissions = token.permissions ?? [];
        session.user.organizationId = token.organizationId ?? null;
        session.user.organizationName = token.organizationName ?? null;
      }
      return session;
    },
  },
});
