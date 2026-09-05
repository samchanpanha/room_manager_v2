"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import { Select } from "@/components/ui/input";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

export function preferredPageSize(key: string, fallback = DEFAULT_PAGE_SIZE): number {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(`pageSize:${key}`);
  if (stored) {
    const v = Number(stored);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const global = window.localStorage.getItem("pageSize:global");
  if (global) {
    const v = Number(global);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return fallback;
}

/// Client-side pagination hook for any list — page state, page-size preference
/// kept per table in localStorage, and auto-clamp when filters shrink the list.
export function usePagination<T>(rows: T[], key: string, fallbackPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => preferredPageSize(key, fallbackPageSize));

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clamped = Math.min(page, pageCount);

  useEffect(() => {
    if (clamped !== page) setPage(clamped);
  }, [clamped, page]);

  useEffect(() => {
    window.localStorage.setItem(`pageSize:${key}`, String(pageSize));
  }, [key, pageSize]);

  const paged = useMemo(() => rows.slice((clamped - 1) * pageSize, clamped * pageSize), [rows, clamped, pageSize]);
  const from = rows.length === 0 ? 0 : (clamped - 1) * pageSize + 1;
  const to = Math.min(clamped * pageSize, rows.length);

  return { page: clamped, setPage, pageSize, setPageSize, pageCount, paged, from, to, total: rows.length };
}

/// Table footer control: prev/next, "x–y of n", and a page-size picker that
/// persists the per-table preference.
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  onPageSize,
  labelId
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  labelId?: string;
}) {
  const { t, tf } = useT();
  if (total === 0) return null;
  const from = page === 1 ? 1 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <p id={labelId} className="text-xs text-muted-foreground">
        {tf("table.showing", { from, to, total, s: total === 1 ? "" : "s" })}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{t("table.rows")}</span>
          <Select
            aria-label={t("table.rowsPerPage")}
            className="h-8 w-auto py-0 text-xs"
            value={String(pageSize)}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t("table.prev")}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          {t("table.next")}
        </Button>
      </div>
    </div>
  );
}