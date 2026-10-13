import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COST, type CostSettings } from "./types";

export async function getCostSettings(): Promise<CostSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "fleet_cost").eq("company", "LOURDES").maybeSingle();
  return { ...DEFAULT_COST, ...((data?.value as Partial<CostSettings>) ?? {}) };
}

/** Opsi dropdown Fleet (tersaring RLS). */
export async function loadFleetOptions() {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: drivers }, { data: employees }, { data: sites }] = await Promise.all([
    supabase.from("fleet_vehicles").select("id, plate, model, company, status, odometer").neq("status", "inactive").order("plate"),
    supabase.from("fleet_drivers_view").select("id, name, nrp, company, is_active").eq("is_active", true).order("name"),
    supabase.from("employees").select("id, name, nrp, company, division").eq("is_active", true).order("name").limit(10000),
    supabase.from("sites").select("id, name, company").eq("is_active", true).order("name"),
  ]);
  return {
    vehicles: (vehicles ?? []).map((v) => ({
      value: v.id as string,
      label: `${v.plate} · ${v.model}`,
      company: v.company as string,
      status: v.status as string,
      odometer: v.odometer as number,
    })),
    drivers: (drivers ?? []).map((d) => ({ value: d.id as string, label: d.name as string, description: d.nrp as string, company: d.company as string })),
    employees: (employees ?? []).map((e) => ({
      value: e.id as string,
      label: e.name as string,
      description: `${e.nrp}${e.division ? " · " + e.division : ""}`,
      company: e.company as string,
    })),
    sites: (sites ?? []).map((s) => ({ value: s.id as string, label: s.name as string, description: s.company as string, company: s.company as string })),
  };
}
export type FleetOptions = Awaited<ReturnType<typeof loadFleetOptions>>;
