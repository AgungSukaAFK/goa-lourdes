"use client";

import { useEffect } from "react";
import { useCustomTheme } from "@/lib/theme-provider";
import type { ProfileCompany } from "@/lib/types";

/** Aksen default ikut company akun, kecuali user sudah memilih sendiri. */
export function CompanyAccent({ company }: { company: ProfileCompany | null }) {
  const { applyDefaultAccent } = useCustomTheme();
  useEffect(() => {
    applyDefaultAccent(company === "GMI" ? "gmi" : company === "GIS" ? "gis" : "zinc");
  }, [company]);
  return null;
}
