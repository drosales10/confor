"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  module: string;
}

interface DashboardNavProps {
  nav: NavItem[];
}

export function DashboardNav({ nav }: DashboardNavProps) {
  const pathname = usePathname();

  if (!nav.length) {
    return null;
  }

  return (
    <nav className="space-y-1">
      {nav.map((item) => (
        <Link
          href={item.href}
          key={item.href}
          className={cn(
            "block rounded-md px-3 py-2 text-sm hover:bg-accent",
            pathname === item.href ? "bg-accent" : "transparent"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
