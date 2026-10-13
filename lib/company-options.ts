import { COMPANY_LABELS, type ProfileCompany } from "@/lib/types";
import type { Option } from "@/components/option-select";

/**
 * Company yang boleh dipilih user saat membuat data.
 * `withLourdes` = untuk master data yang berlaku di semua PT (site, karyawan).
 */
export function companyOptions(
  profile: { company: ProfileCompany | null; is_moderator: boolean },
  withLourdes = false,
): Option[] {
  const all: ProfileCompany[] =
    profile.is_moderator || profile.company === "LOURDES"
      ? withLourdes
        ? ["GMI", "GIS", "LOURDES"]
        : ["GMI", "GIS"]
      : profile.company
        ? [profile.company]
        : [];
  return all.map((c) => ({ value: c, label: c, description: COMPANY_LABELS[c] }));
}
