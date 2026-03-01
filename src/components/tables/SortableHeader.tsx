"use client";

import React from "react";

type SortOrder = "asc" | "desc";

export function SortableHeader(props: {
  label: string;
  sortKey: string;
  sortBy?: string;
  sortOrder: SortOrder;
  onToggle: (sortKey: string) => void;
  className?: string;
}) {
  const { label, sortKey, sortBy, sortOrder, onToggle, className } = props;
  const active = sortBy === sortKey;

  return (
    <button className={className ?? "text-left"} onClick={() => onToggle(sortKey)} type="button">
      {label}
      {active ? (sortOrder === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}
