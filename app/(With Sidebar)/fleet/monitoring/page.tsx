import type { Metadata } from "next";
import { Content } from "@/components/content";
import { requireFleet } from "@/lib/fleet/guard";
import { getCostSettings } from "@/lib/fleet/server";
import { getCompanyFilter } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { LiveMap } from "./live-map";

export const metadata: Metadata = { title: "Monitoring GPS" };

export default async function MonitoringPage() {
  const s = await requireFleet(["admin"]);
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  let q = supabase
    .from("fleet_bookings_view")
    .select("id, code, vehicle_plate, driver_name, destination, last_lat, last_lng, last_seen_at")
    .eq("status", "in_use")
    .order("started_at");
  if (filter) q = q.eq("company", filter);
  const [{ data }, cost] = await Promise.all([q, getCostSettings()]);
  return (
    <Content
      title="Monitoring GPS"
      description="Posisi kendaraan yang sedang dalam perjalanan. Merah = lebih dari 5 menit tanpa update (layar HP driver mungkin terkunci)."
    >
      <LiveMap
        pool={[cost.poolLat, cost.poolLng]}
        trips={(data ?? []).map((t) => ({
          id: t.id,
          code: t.code,
          plate: t.vehicle_plate,
          driver: t.driver_name,
          destination: t.destination,
          lat: t.last_lat,
          lng: t.last_lng,
          seen: t.last_seen_at,
        }))}
      />
    </Content>
  );
}
