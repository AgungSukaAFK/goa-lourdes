// Dipakai server (query) & client (header tabel) - jangan beri "use client".

export type SortDirection = "asc" | "desc";

export type SortColumnConfig = {
  // Kolom DB yang dipakai di `.order()`.
  column: string;
  // true = arah dibalik saat query, mis. "Umur" (umur terlama = created_at
  // paling awal).
  invert?: boolean;
};

// Ubah nilai param `sort` jadi argumen `.order()`. Key di luar whitelist
// diabaikan (pakai fallback) supaya URL asal-asalan tidak bikin query error.
export function resolveSort(
  value: string,
  columns: Record<string, SortColumnConfig>,
  fallback: string,
): {
  key: string;
  direction: SortDirection;
  column: string;
  ascending: boolean;
} {
  const parse = (v: string) => {
    const [key, dir] = v.split(".");
    const config = columns[key];
    if (!config || (dir !== "asc" && dir !== "desc")) return null;
    const direction = dir as SortDirection;
    const ascending = config.invert
      ? direction === "desc"
      : direction === "asc";
    return { key, direction, column: config.column, ascending };
  };
  return parse(value) ?? parse(fallback)!;
}
