"use client";

import { SortableTableHead, type SortDirection } from "@/components/sortable-table-head";
import { useQueryParams } from "@/hooks/use-query-params";

/** SortableTableHead yang langsung terhubung ke ?sort= di URL. */
export function SortHead({
  k,
  children,
  defaultDirection,
  className,
}: {
  k: string;
  children: React.ReactNode;
  defaultDirection?: SortDirection;
  className?: string;
}) {
  const { get, set } = useQueryParams();
  return (
    <SortableTableHead
      sortKey={k}
      currentSort={get("sort")}
      onSortChange={(v) => set({ sort: v ?? null }, { keepPage: true })}
      defaultDirection={defaultDirection}
      className={className}
    >
      {children}
    </SortableTableHead>
  );
}
