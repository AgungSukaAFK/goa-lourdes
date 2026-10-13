import "server-only";
import { companyOptions } from "@/lib/company-options";
import type { Session } from "@/lib/auth/session";
import { loadCategories, loadTeam } from "./server";
import type { CompanyCode } from "@/lib/types";

/** Data bersama halaman GOA untuk TaskCard / form. */
export async function loadTaskCtx(s: Session & { isSupervisor: boolean; canWork: boolean }, company: CompanyCode | null) {
  const [team, categories] = await Promise.all([loadTeam(company), loadCategories()]);
  const opts = companyOptions(s.profile, true);
  return {
    team,
    ctx: {
      selfId: s.userId,
      isSupervisor: s.isSupervisor,
      canWork: s.canWork,
      members: team.filter((m) => m.role !== "guest").map((m) => ({ value: m.id, label: m.name, description: m.title ?? undefined })),
      categories,
      companies: opts,
    },
  };
}
