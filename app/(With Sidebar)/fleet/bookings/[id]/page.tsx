import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Content } from "@/components/content";
import { StatusBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCostSettings, loadFleetOptions } from "@/lib/fleet/server";
import { FLEET_BOOKING_STATUS, FLEET_P2H_RESULT } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { BookingActions } from "./booking-actions";
import { LiveRoute } from "./live-route";
import { TripTracker } from "./trip-tracker";

export const metadata: Metadata = { title: "Detail Booking" };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await requireFleet();
  const supabase = await createClient();
  const { data: b } = await supabase.from("fleet_bookings_view").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();

  const [{ data: points }, { data: vehicle }, options, cost] = await Promise.all([
    supabase.from("fleet_trip_points").select("lat, lng").eq("booking_id", id).order("recorded_at").limit(5000),
    supabase.from("fleet_vehicles").select("odometer").eq("id", b.vehicle_id).single(),
    s.isAdmin ? loadFleetOptions() : Promise.resolve(null),
    getCostSettings(),
  ]);

  const isDriver = !!s.myDriverId && b.driver_id === s.myDriverId;
  const dest: [number, number] | null = b.dest_lat && b.dest_lng ? [b.dest_lat, b.dest_lng] : null;
  const info: [string, React.ReactNode][] = [
    ["Kendaraan", `${b.vehicle_plate} · ${b.vehicle_model}`],
    ["Pemohon", b.requester_name ? `${b.requester_name} (${b.requester_nrp})` : "-"],
    ["Driver", b.driver_name ?? "Belum ditentukan"],
    ["Jadwal", `${formatDateTime(b.start_time)} s/d ${formatDateTime(b.end_time)}`],
    ["Tujuan", b.destination ?? "-"],
    ["Keperluan", b.purpose],
    ["Estimasi", b.est_cost ? `${formatNumber(b.est_distance_km, 1)} km · ${formatCurrency(b.est_cost)}` : "-"],
    [
      "P2H",
      b.p2h_id ? (
        <Link key="p" href={`/fleet/p2h/history/${b.p2h_id}`} className="hover:underline">
          <StatusBadge map={FLEET_P2H_RESULT} value={b.p2h_result} />
        </Link>
      ) : (
        "Belum diisi"
      ),
    ],
  ];
  if (b.started_at) info.push(["Berangkat", `${formatDateTime(b.started_at)}${b.start_odo ? ` · KM ${formatNumber(b.start_odo)}` : ""}`]);
  if (b.finished_at)
    info.push([
      "Kembali",
      `${formatDateTime(b.finished_at)} · KM ${formatNumber(b.end_odo)} (${formatNumber((b.end_odo ?? 0) - (b.start_odo ?? 0))} km, GPS ${formatNumber(b.gps_distance_km, 1)} km)`,
    ]);
  if (b.p2h_override) info.push(["Catatan", "Berangkat dengan override admin tanpa P2H layak."]);
  if (b.decision_note) info.push(["Catatan GA", b.decision_note]);

  return (
    <>
      <Content
        title={`Booking ${b.code}`}
        description={b.destination ?? undefined}
        cardAction={
          <BookingActions
            booking={b}
            drivers={(options?.drivers ?? []).filter((d) => d.company === b.company || d.company === "LOURDES")}
            perms={{ admin: s.isAdmin, isDriver, isRequester: b.requested_by === s.userId }}
            vehicleOdometer={vehicle?.odometer ?? 0}
          />
        }
      >
        <div className="space-y-4">
          <StatusBadge map={FLEET_BOOKING_STATUS} value={b.status} />
          {b.status === "in_use" && isDriver && <TripTracker bookingId={b.id} />}
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Content>
      <Content
        title="Peta perjalanan"
        description={b.status === "in_use" ? "Posisi diperbarui otomatis." : points?.length ? `${points.length} titik GPS` : "Belum ada data GPS."}
      >
        <LiveRoute
          bookingId={b.id}
          initial={(points ?? []).map((p) => [p.lat, p.lng] as [number, number])}
          destination={dest}
          pool={[cost.poolLat, cost.poolLng]}
          live={b.status === "in_use"}
          label={b.vehicle_plate}
        />
      </Content>
    </>
  );
}
