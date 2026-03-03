"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardNav } from "@/components/DashboardNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";

type NavItem = {
  href: string;
  label: string;
  module: string;
};

type DashboardShellProps = {
  nav: NavItem[];
  children: React.ReactNode;
};

export function DashboardShell({ nav, children }: DashboardShellProps) {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={toggleSidebar}>
          {sidebarOpen ? <ChevronLeft className="mr-1 size-4" /> : <ChevronRight className="mr-1 size-4" />}
          {sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
        </Button>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${sidebarOpen ? "md:grid-cols-[240px_1fr]" : "md:grid-cols-1"}`}>
        {sidebarOpen ? (
          <Card>
            <CardContent className="p-3">
              <DashboardNav nav={nav} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="p-4">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
