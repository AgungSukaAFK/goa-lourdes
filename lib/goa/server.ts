import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyCode } from "@/lib/types";
import type { KpiParam, TeamMember } from "./types";

export async function loadTeam(company: CompanyCode | null) {
  const supabase = await createClient();
  let q = supabase.from("goa_team_view").select("*").order("name");
  if (company) q = q.in("company", [company, "LOURDES"]);
  const { data } = await q;
  return (data ?? []) as TeamMember[];
}

export async function loadKpiSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("goa_kpi_settings").select("target, parameters");
  return (data ?? []) as { target: string; parameters: KpiParam[] }[];
}

export async function loadCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("goa_categories").select("name").order("sort");
  return (data ?? []).map((c) => c.name as string);
}

/** Batas awal periode KPI. */
export function periodStart(period: string) {
  const days = { week: 7, month: 30, "3months": 90, "6months": 180, year: 365 }[period] ?? 30;
  return new Date(Date.now() - days * 86400000);
}

export const PERIODS = [
  { value: "week", label: "7 hari" },
  { value: "month", label: "30 hari" },
  { value: "3months", label: "3 bulan" },
  { value: "6months", label: "6 bulan" },
  { value: "year", label: "1 tahun" },
];

/** KPI semua anggota untuk periode berjalan & periode sebelumnya (untuk tren). */
export async function teamKpi(company: CompanyCode | null, period: string) {
  const { computeKpi, paramsFor } = await import("./kpi");
  const supabase = await createClient();
  const start = periodStart(period);
  const prevStart = new Date(start.getTime() - (Date.now() - start.getTime()));
  let q = supabase.from("goa_tasks_view").select("*").gte("created_at", prevStart.toISOString()).not("assignee_id", "is", null).limit(20000);
  if (company) q = q.in("company", [company, "LOURDES"]);
  const [team, settings, { data }] = await Promise.all([loadTeam(company), loadKpiSettings(), q]);
  const tasks = (data ?? []) as import("./types").GoaTask[];
  return team
    .filter((m) => m.role !== "guest")
    .map((m) => {
      const mine = tasks.filter((t) => t.assignee_id === m.id);
      const params = paramsFor(m.id, settings);
      const cur = mine.filter((t) => new Date(t.created_at) >= start);
      const prev = mine.filter((t) => new Date(t.created_at) < start);
      return { member: m, kpi: computeKpi(m, cur, params), prev: prev.length ? computeKpi(m, prev, params) : null, tasks: cur };
    })
    .sort((a, b) => (b.kpi.score ?? -1) - (a.kpi.score ?? -1));
}
