import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, ClipboardCheck, FileWarning, Gauge, Truck, Wallet, Wrench } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { StatusBreakdown } from "@/components/dashboard/breakdown-list";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart-card";
import { StatusBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { FLEET_BOOKING_STATUS, FLEET_P2H_RESULT, FLEET_VEHICLE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNumber, formatRupiahShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard Fleet" };

type Dash = {
  vehicles: number;
  by_status: Record<string, number>;
  bookings_pending: number;
  trips_active: number;
  bookings_today: number;
  p2h_today: number;
  p2h_result_30: Record<string, number>;
  p2h_avg_30: number | null;
  repairs_open: number;
  repairs_critical: number;
  docs_due: number;
  service_due: number;
  fuel_month: number;
  repair_cost_month: number;
  p2h_daily: { date: string; count: number }[];
};

export default async function FleetDashboard() {
  const s = await requireFleet();
  // Driver & karyawan tidak punya dashboard: langsung ke booking.
  if (!s.isAdmin) redirect("/fleet/bookings");
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  const startToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  let uq = supabase
    .from("fleet_bookings_view")
    .select("id, code, vehicle_plate, requester_name, driver_name, start_time, destination, status, p2h_result")
    .in("status", ["pending", "approved", "in_use"])
    .gte("end_time", `${startToday}T00:00:00+07:00`)
    .order("start_time")
    .limit(8);
  if (filter) uq = uq.eq("company", filter);
  const [{ data }, { data: upcoming }] = await Promise.all([supabase.rpc("fleet_dashboard", { p_company: filter }), uq]);
  const d = data as Dash;
  const score = Math.max(40, (d.p2h_avg_30 ?? 100) - d.repairs_open * 5);

  return (
    <>
      <StatTile label="Skor kelayakan armada" value={`${score}%`} icon={Gauge} hint={`Rata-rata P2H 30 hari ${d.p2h_avg_30 ?? "-"} · −5 per perbaikan terbuka`} />
      <StatTile
        label="Kendaraan"
        value={formatNumber(d.vehicles)}
        icon={Truck}
        href="/fleet/vehicles"
        attention={(d.by_status.grounded ?? 0) > 0}
        hint={`${d.by_status.available ?? 0} tersedia · ${d.by_status.in_use ?? 0} dipakai · ${d.by_status.grounded ?? 0} tidak layak`}
      />
      <StatTile
        label="Booking"
        value={formatNumber(d.bookings_today)}
        icon={CalendarClock}
        href="/fleet/bookings?status=pending"
        attention={d.bookings_pending > 0}
        hint={`hari ini · ${d.bookings_pending} menunggu GA · ${d.trips_active} di jalan`}
      />
      <StatTile label="P2H hari ini" value={formatNumber(d.p2h_today)} icon={ClipboardCheck} href="/fleet/p2h/history" hint="Pra-perjalanan & mingguan" />
      <StatTile
        label="Perbaikan terbuka"
        value={formatNumber(d.repairs_open)}
        icon={d.repairs_critical ? AlertTriangle : Wrench}
        href="/fleet/repairs"
        attention={d.repairs_critical > 0}
        hint={`${d.repairs_critical} kritis`}
      />
      <StatTile
        label="Dokumen & servis"
        value={formatNumber(d.docs_due + d.service_due)}
        icon={FileWarning}
        href="/fleet/vehicles?doc=due"
        attention={d.docs_due + d.service_due > 0}
        hint={`${d.docs_due} pajak/KIR ≤ 30 hari · ${d.service_due} servis ≤ 500 km`}
      />
      <StatTile label="Biaya bulan ini" value={formatRupiahShort(d.fuel_month + d.repair_cost_month)} icon={Wallet} hint={`BBM ${formatRupiahShort(d.fuel_month)} · perbaikan ${formatRupiahShort(d.repair_cost_month)}`} />

      <Content size="md" title="Jadwal berjalan & mendatang">
        {!upcoming?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada booking aktif.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Berangkat</TableHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    <Link href={`/fleet/bookings/${b.id}`} className="hover:underline">{formatDateTime(b.start_time)}</Link>
                    <div className="max-w-[12rem] truncate text-xs text-muted-foreground">{b.destination}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{b.vehicle_plate}</span>
                    <div className="text-xs text-muted-foreground">{b.driver_name ?? "driver belum ada"}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={FLEET_BOOKING_STATUS} value={b.status} />
                    {b.status === "approved" && !b.p2h_result && <div className="mt-1 text-xs text-orange-700 dark:text-orange-300">P2H belum</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Content>

      <Content size="md" title="Status kendaraan">
        <StatusBreakdown map={FLEET_VEHICLE_STATUS} counts={d.by_status} hrefFor={(st) => `/fleet/vehicles?status=${st}`} />
      </Content>

      <Content size="md" title="Hasil P2H 30 hari">
        <StatusBreakdown map={FLEET_P2H_RESULT} counts={d.p2h_result_30} hrefFor={(st) => `/fleet/p2h/history?result=${st}`} />
      </Content>

      <Content size="md" title="Jumlah P2H per hari" description="14 hari terakhir.">
        <HorizontalBarChart
          label="P2H"
          data={d.p2h_daily.map((x) => ({ name: new Date(x.date).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" }), value: x.count }))}
        />
      </Content>
    </>
  );
}
