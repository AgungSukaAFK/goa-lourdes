"use client";

import { useEffect } from "react";
import { useOptionalCustomTheme } from "@/lib/theme-provider";
import type { ProfileCompany } from "@/lib/types";

/** Aksen default ikut company akun, kecuali user sudah memilih sendiri. */
export function CompanyAccent({ company }: { company: ProfileCompany | null }) {
  const theme = useOptionalCustomTheme();
  useEffect(() => {
    theme?.applyDefaultAccent(company === "GMI" ? "gmi" : company === "GIS" ? "gis" : "zinc");
  }, [company, !!theme]);
  return null;
}
