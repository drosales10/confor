import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SileoToaster from "@/components/SileoToaster";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await prisma.systemConfiguration.findFirst({
    where: {
      organizationId: null,
      category: "general",
      key: "site_name",
    },
    select: { value: true },
  });

  const appName = config?.value?.trim() || "Modular Enterprise App";

  return {
    title: appName,
    description: "Aplicación modular full-stack con Next.js y PostgreSQL",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        {children}
        <SileoToaster />
      </body>
    </html>
  );
}
