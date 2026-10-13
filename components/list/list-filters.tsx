"use client";

import { Search, X } from "lucide-react";
import { FilterPanel, formatFilterDate, type ActiveFilter } from "@/components/filter-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/option-select";
import { useQueryParams } from "@/hooks/use-query-params";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";

export type FilterOption = { value: string; label: string };

export type FilterField =
  | { type: "select"; key: string; label: string; options: FilterOption[]; placeholder?: string }
  | { type: "date"; key: string; label: string };

const ALL = "__all__";

/**
 * Toolbar list standar: kotak cari (?q=) + FilterPanel berisi field
 * select/date. Chip filter aktif disusun otomatis dari `fields`.
 */
export function ListFilters({
  searchPlaceholder = "Cari...",
  fields = [],
  actions,
  search = true,
}: {
  search?: boolean;
  searchPlaceholder?: string;
  fields?: FilterField[];
  actions?: React.ReactNode;
}) {
  const { get, set, reset } = useQueryParams();
  const [q, onQ, resetQ] = useUrlSearchInput(get("q"), (v) => set({ q: v }));

  const active: ActiveFilter[] = [];
  for (const f of fields) {
    const v = get(f.key);
    if (!v) continue;
    const label =
      f.type === "select" ? (f.options.find((o) => o.value === v)?.label ?? v) : formatFilterDate(v);
    active.push({ key: f.key, label: f.label, value: label, onRemove: () => set({ [f.key]: null }) });
  }

  return (
    <div className="space-y-3">
      {(search || actions) && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {search && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8"
            aria-label="Cari"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                resetQ("");
                set({ q: null });
              }}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        )}
        {actions && <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>}
      </div>
      )}

      {fields.length > 0 && (
        <FilterPanel
          activeFilters={active}
          onReset={() => {
            resetQ(get("q"));
            reset(["q", "sort"]);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                {f.type === "select" ? (
                  <OptionSelect
                    options={[{ value: ALL, label: "Semua" }, ...f.options]}
                    value={get(f.key) || ALL}
                    onValueChange={(v) => set({ [f.key]: v === ALL ? null : v })}
                    placeholder={f.placeholder ?? "Semua"}
                  />
                ) : (
                  <Input type="date" value={get(f.key)} onChange={(e) => set({ [f.key]: e.target.value || null })} />
                )}
              </div>
            ))}
          </div>
        </FilterPanel>
      )}
    </div>
  );
}
