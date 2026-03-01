"use client";

import React from "react";

export function TableToolbar(props: {
  searchPlaceholder?: string;
  search: string;
  onSearchChange: (value: string) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  total?: number;
  canExport?: boolean;
  exportLimit?: number;
  onExportLimitChange?: (value: number) => void;
}) {
  const {
    searchPlaceholder,
    search,
    onSearchChange,
    limit,
    onLimitChange,
    total,
    canExport,
    exportLimit,
    onExportLimitChange,
  } = props;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <input
        className="w-full rounded-md border px-3 py-2 text-sm sm:max-w-sm"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder ?? "Buscar"}
        value={search}
      />
      <div className="flex items-center gap-2">
        {canExport && exportLimit !== undefined && onExportLimitChange ? (
          <label className="text-xs">
            <span className="mr-1">Export</span>
            <select
              className="rounded-md border px-2 py-1"
              onChange={(event) => onExportLimitChange(Number(event.target.value))}
              value={exportLimit}
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
            </select>
          </label>
        ) : null}

        <label className="text-xs">
          <span className="mr-1">Límite</span>
          <select
            className="rounded-md border px-2 py-1"
            onChange={(event) => onLimitChange(Number(event.target.value))}
            value={limit}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        {typeof total === "number" ? <p className="text-xs text-muted-foreground">Total: {total}</p> : null}
      </div>
    </div>
  );
}
