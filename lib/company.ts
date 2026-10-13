import "server-only";
import { cookies } from "next/headers";
import type { CompanyCode } from "@/lib/types";
import type { Session } from "@/lib/auth/session";

export const COMPANY_FILTER_COOKIE = "company-filter";

/** Moderator & user LOURDES boleh memilih company yang ditampilkan. */
export function canSwitchCompany(session: Session) {
  return session.profile.is_moderator || session.profile.company === "LOURDES";
}

/**
 * Company yang sedang difilter: null = semua yang boleh dilihat.
 * User GMI/GIS selalu terkunci ke company-nya (RLS juga menjaganya).
 */
export async function getCompanyFilter(session: Session): Promise<CompanyCode | null> {
  if (!canSwitchCompany(session)) {
    const c = session.profile.company;
    return c === "GMI" || c === "GIS" ? c : null;
  }
  const v = (await cookies()).get(COMPANY_FILTER_COOKIE)?.value;
  return v === "GMI" || v === "GIS" ? v : null;
}

/** Company default untuk data baru (form). */
export function defaultCompanyFor(session: Session, filter: CompanyCode | null): CompanyCode {
  if (filter) return filter;
  const c = session.profile.company;
  return c === "GIS" ? "GIS" : "GMI";
}
