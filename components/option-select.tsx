"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";

export type Option = { value: string; label: string; description?: string };

/**
 * Select dari daftar opsi. > 7 opsi otomatis pakai SearchableSelect
 * (aturan styling guide §8).
 */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Pilih...",
  disabled,
  name,
  id,
  className,
  "aria-invalid": invalid,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  if (options.length > 7) {
    return (
      <SearchableSelect value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
        <SearchableSelectTrigger id={id} className={className ?? "w-full"} aria-invalid={invalid}>
          <SearchableSelectValue placeholder={placeholder} />
        </SearchableSelectTrigger>
        <SearchableSelectContent searchPlaceholder="Cari...">
          {options.map((o) => (
            <SearchableSelectItem key={o.value} value={o.value} textValue={`${o.label} ${o.description ?? ""}`}>
              {o.label}
              {o.description && <span className="ml-1 text-xs text-muted-foreground">{o.description}</span>}
            </SearchableSelectItem>
          ))}
        </SearchableSelectContent>
      </SearchableSelect>
    );
  }
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.description && <span className="ml-1 text-xs text-muted-foreground">{o.description}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
