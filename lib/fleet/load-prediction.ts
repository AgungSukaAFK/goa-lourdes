import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyCode } from "@/lib/types";
import type { Part, Vehicle } from "./types";
import type { ServiceLog, Usage } from "./prediction";

export async function loadPredictionInputs(company: CompanyCode | null) {
  const supabase = await createClient();
  let vq = supabase.from("fleet_vehicles").select("*").neq("status", "inactive").order("plate");
  if (company) vq = vq.eq("company", company);
  const [{ data: vehicles }, { data: parts }, { data: usage }, { data: logs }] = await Promise.all([
    vq,
    supabase.from("fleet_parts").select("*").eq("is_active", true).order("name"),
    supabase.from("fleet_vehicle_usage").select("*"),
    supabase.from("fleet_service_logs").select("vehicle_id, part_id, odometer, serviced_at").not("part_id", "is", null),
  ]);
  return {
    vehicles: (vehicles ?? []) as Vehicle[],
    parts: (parts ?? []) as Part[],
    usage: (usage ?? []) as Usage[],
    logs: (logs ?? []) as ServiceLog[],
  };
}
