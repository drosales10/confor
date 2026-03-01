"use client";

import React from "react";

export function TablePagination(props: {
  page: number;
  totalPages: number;
  total: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { page, totalPages, total, loading, onPrev, onNext } = props;

  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      <button
        className="rounded-md border px-2 py-1 disabled:opacity-60"
        disabled={page <= 1 || Boolean(loading)}
        onClick={onPrev}
        type="button"
      >
        Anterior
      </button>
      <span>
        Página {page} de {totalPages} · Total {total}
      </span>
      <button
        className="rounded-md border px-2 py-1 disabled:opacity-60"
        disabled={page >= totalPages || Boolean(loading)}
        onClick={onNext}
        type="button"
      >
        Siguiente
      </button>
    </div>
  );
}
