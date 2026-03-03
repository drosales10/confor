"use client";

import dynamic from "next/dynamic";

const GeoDashboardMap = dynamic(
  () => import("@/components/GeoDashboardMap").then((module) => module.GeoDashboardMap),
  { ssr: false },
);

export function GeoDashboardMapClient() {
  return <GeoDashboardMap />;
}
