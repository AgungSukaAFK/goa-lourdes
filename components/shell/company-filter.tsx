"use client";

import { useTransition } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setCompanyFilter } from "@/lib/actions/company";

/** Filter company untuk Moderator & user LOURDES (disimpan di cookie). */
export function CompanyFilter({ value }: { value: "GMI" | "GIS" | null }) {
  const [pending, start] = useTransition();

  return (
    <Select
      value={value ?? "ALL"}
      onValueChange={(v) => start(() => setCompanyFilter(v as "ALL" | "GMI" | "GIS"))}
      disabled={pending}
    >
      <SelectTrigger size="sm" className="w-[7.5rem] sm:w-[9.5rem]" aria-label="Filter perusahaan">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Building2 className="size-4 text-muted-foreground" />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="ALL">Semua PT</SelectItem>
        <SelectItem value="GMI">GMI</SelectItem>
        <SelectItem value="GIS">GIS</SelectItem>
      </SelectContent>
    </Select>
  );
}
