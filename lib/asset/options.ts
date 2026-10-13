import "server-only";
import { createClient } from "@/lib/supabase/server";
import { companyOptions } from "@/lib/company-options";
import type { Session } from "@/lib/auth/session";
import type { Category } from "./types";

/** Opsi dropdown form aset/pinjam/mutasi (sudah tersaring RLS per PT). */
export async function loadAssetOptions(session: Session) {
  const supabase = await createClient();
  const [{ data: cats }, { data: sites }, { data: emps }] = await Promise.all([
    supabase.from("asset_categories").select("id, name, code, depreciation_years").order("name"),
    supabase.from("sites").select("id, name, company").eq("is_active", true).order("name"),
    supabase.from("employees").select("id, nrp, name, company, position").eq("is_active", true).order("name").limit(10000),
  ]);
  return {
    companies: companyOptions(session.profile),
    categories: (cats ?? []) as Category[],
    sites: (sites ?? []).map((s) => ({ value: s.id, label: s.name, description: s.company, company: s.company as string })),
    employees: (emps ?? []).map((e) => ({
      value: e.id,
      label: e.name,
      description: `${e.nrp}${e.position ? " · " + e.position : ""}`,
      company: e.company as string,
    })),
  };
}

/** Daftar aset untuk dropdown pinjam/mutasi/audit. */
export async function loadAssetPicks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets_view")
    .select("id, code, name, company, status, is_borrowable, owner_employee_id, owner_name")
    .neq("status", "disposed")
    .order("code")
    .limit(20000);
  return (data ?? []).map((a) => ({
    value: a.id as string,
    label: `${a.code} · ${a.name}`,
    description: a.owner_name ? `PIC ${a.owner_name}` : undefined,
    company: a.company as string,
    status: a.status as string,
    is_borrowable: a.is_borrowable as boolean,
    owner_employee_id: a.owner_employee_id as string | null,
  }));
}
