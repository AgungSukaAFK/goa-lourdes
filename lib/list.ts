import { resolveSort, type SortColumnConfig } from "@/lib/sort";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Halaman (1-based) + range Supabase. */
export function pageRange(sp: SearchParams, pageSize = 20) {
  const page = Math.max(1, Number.parseInt(param(sp, "page") || "1", 10) || 1);
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function sortFrom(
  sp: SearchParams,
  columns: Record<string, SortColumnConfig>,
  fallback: string,
) {
  return resolveSort(param(sp, "sort"), columns, fallback);
}

/** Escape untuk filter `ilike` / `or()` PostgREST. */
export function ilikeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")}%`;
}
