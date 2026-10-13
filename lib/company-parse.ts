import type { ProfileCompany } from "@/lib/types";

/** "PT. Garuda Mart Indonesia" / "gmi" -> GMI, dst. null kalau tidak dikenal. */
export function parseCompany(input: string | null | undefined): ProfileCompany | null {
  const v = (input ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("lourdes")) return "LOURDES";
  if (v.includes("gmi") || v.includes("garuda")) return "GMI";
  if (v.includes("gis") || v.includes("global inti") || v.includes("inti sejati")) return "GIS";
  return null;
}
