"use client";

import { CustomPagination } from "@/components/custom-pagination";
import { useQueryParams } from "@/hooks/use-query-params";
import { formatNumber } from "@/lib/utils";

/** Paginasi + "Menampilkan 1–20 dari 135", state di ?page=. */
export function ListPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const { set } = useQueryParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-2 pt-2 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Menampilkan {formatNumber(start)}–{formatNumber(end)} dari {formatNumber(total)}
      </p>
      {totalPages > 1 && (
        <div>
          <CustomPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => set({ page: p === 1 ? null : String(p) }, { keepPage: true })}
          />
        </div>
      )}
    </div>
  );
}
