"use client";

// Header tabel yang bisa diklik untuk sorting. State sort disimpan di URL
// (`?sort=<key>.<asc|desc>`) oleh halaman pemakainya, supaya ikut ke
// pagination & bisa di-share. Klik berputar: arah default -> kebalikannya ->
// kembali ke urutan bawaan halaman (param `sort` dihapus).

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { SortDirection } from "@/lib/sort";

export type { SortColumnConfig, SortDirection } from "@/lib/sort";

type Props = {
  sortKey: string;
  // Nilai param `sort` saat ini (boleh kosong).
  currentSort: string;
  onSortChange: (value: string | undefined) => void;
  // Arah saat pertama kali diklik, mis. "desc" utk harga/tanggal (terbesar /
  // terbaru dulu).
  defaultDirection?: SortDirection;
  className?: string;
  children: React.ReactNode;
};

export function SortableTableHead({
  sortKey,
  currentSort,
  onSortChange,
  defaultDirection = "asc",
  className,
  children,
}: Props) {
  const [activeKey, activeDir] = currentSort.split(".");
  const isActive = activeKey === sortKey;
  const direction = isActive ? (activeDir as SortDirection) : undefined;

  const handleClick = () => {
    if (!isActive) {
      onSortChange(`${sortKey}.${defaultDirection}`);
    } else if (direction === defaultDirection) {
      onSortChange(`${sortKey}.${defaultDirection === "asc" ? "desc" : "asc"}`);
    } else {
      onSortChange(undefined);
    }
  };

  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
  const alignRight = className?.includes("text-right");

  return (
    <TableHead
      className={className}
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          alignRight && "flex-row-reverse",
          isActive && "text-foreground",
        )}
        title="Klik untuk mengurutkan"
      >
        {children}
        <Icon
          className={cn("h-3.5 w-3.5 shrink-0", !isActive && "opacity-40")}
        />
      </button>
    </TableHead>
  );
}
