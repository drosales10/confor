"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuItem = {
  href: string;
  label: string;
};

type UserMenuProps = {
  fullName: string;
  avatarUrl?: string | null;
  items: UserMenuItem[];
};

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function UserMenu({ fullName, avatarUrl, items }: UserMenuProps) {
  const initials = getInitials(fullName);

  async function onLogout() {
    if (typeof document !== "undefined") {
      document.cookie = "RolUsuario=; path=/; max-age=0";
      document.cookie = "OrgName=; path=/; max-age=0";
      document.cookie = "EmailUsuario=; path=/; max-age=0";
    }

    await signOut({ callbackUrl: "/login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 hover:bg-accent"
          aria-label="Menú de usuario"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={fullName} width={32} height={32} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">{fullName}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onLogout()}>
          Cierre de Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
