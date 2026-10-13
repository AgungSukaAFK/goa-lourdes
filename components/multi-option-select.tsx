"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { OptionSelect, type Option } from "@/components/option-select";

/** Pilih banyak opsi -> chip yang bisa dihapus. */
export function MultiOptionSelect({
  value,
  onChange,
  options,
  placeholder = "Tambah...",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  placeholder?: string;
}) {
  const [current, setCurrent] = useState("");
  return (
    <div className="space-y-2">
      <OptionSelect
        value={current}
        onValueChange={(v) => {
          if (v && !value.includes(v)) onChange([...value, v]);
          setCurrent("");
        }}
        options={options.filter((o) => !value.includes(o.value))}
        placeholder={placeholder}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li key={id} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border bg-background pl-2.5 pr-1 text-xs shadow-xs">
              <span className="truncate">{options.find((o) => o.value === id)?.label ?? id}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Hapus"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
