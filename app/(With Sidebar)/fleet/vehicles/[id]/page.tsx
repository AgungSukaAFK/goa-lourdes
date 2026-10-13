import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Content } from "@/components/content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { DocDue } from "@/components/doc-due";
import { TimeLineChart } from "@/components/dashboard/line-chart";
import { requireFleet } from "@/lib/fleet/guard";
import { companyOptions } from "@/lib/company-options";
import { COMPANY_TONE, FLEET_BOOKING_STATUS, FLEET_FUEL_RATING, FLEET_P2H_RESULT, FLEET_REPAIR_STATUS, FLEET_VEHICLE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { Vehicle } from "@/lib/fleet/types";
import { VehicleActions } from "./vehicle-actions";

export const metadata: Metadata = { title: "Detail Kendaraan" };

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await requireFleet(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("fleet_vehicles").select("*, site:sites(name)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const v = data as Vehicle & { site: { name: string } | null };

  const [{ data: odo }, { data: p2h }, { data: repairs }, { data: bookings }, { data: fuel }, { data: services }, { data: sites }, { data: parts }, { data: drivers }] =
    await Promise.all([
      supabase.from("fleet_odometer_logs").select("odometer, recorded_at").eq("vehicle_id", id).order("recorded_at").limit(500),
      supabase.from("fleet_p2h_view").select("id, code, created_at, kind, driver_name, score, result").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(30),
      supabase.from("fleet_repairs").select("id, code, component, status, actual_cost, created_at, done_at").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("fleet_bookings_view").select("id, code, start_time, requester_name, destination, status").eq("vehicle_id", id).order("start_time", { ascending: false }).limit(30),
      supabase.from("fleet_fuel_view").select("id, date, distance_km, liters, km_per_liter, total_cost, rating").eq("vehicle_id", id).order("date", { ascending: false }).limit(30),
      supabase.from("fleet_service_logs").select("id, serviced_at, odometer, cost, notes, part:fleet_parts(name)").eq("vehicle_id", id).order("serviced_at", { ascending: false }).limit(30),
      supabase.from("sites").select("id, name, company").eq("is_active", true),
      supabase.from("fleet_parts").select("id, name").eq("is_active", true).order("name"),
      supabase.from("fleet_driver_vehicles").select("driver:fleet_drivers_view(name)").eq("vehicle_id", id),
    ]);

  const left = v.last_service_odo + v.service_interval_km - v.odometer;
  const info: [string, React.ReactNode][] = [
    ["Merek / tahun", [v.brand, v.year].filter(Boolean).join(" · ") || "-"],
    ["Site / pool", v.site?.name ?? "-"],
    ["KM saat ini", `${formatNumber(v.odometer)} km`],
    ["Servis berkala", `tiap ${formatNumber(v.service_interval_km)} km · ${left <= 0 ? `lewat ${formatNumber(-left)} km` : `${formatNumber(left)} km lagi`}`],
    ["Pajak / STNK", <DocDue key="t" date={v.tax_date} />],
    ["KIR", <DocDue key="k" date={v.kir_date} />],
    ["Ganti plat", <DocDue key="p" date={v.plate_date} />],
    ["Driver tetap", (drivers ?? []).map((d) => (d.driver as unknown as { name: string })?.name).filter(Boolean).join(", ") || "-"],
  ];

  return (
    <>
      <Content
        title={`${v.plate} · ${v.model}`}
        cardAction={
          <VehicleActions
            vehicle={v}
            companies={companyOptions(s.profile)}
            sites={(sites ?? []).map((x) => ({ value: x.id, label: x.name, company: x.company as string }))}
            parts={(parts ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge map={FLEET_VEHICLE_STATUS} value={v.status} />
            <ToneBadge tone={COMPANY_TONE[v.company]}>{v.company}</ToneBadge>
          </div>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {info.map(([k, val]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                <dd className="mt-0.5">{val}</dd>
              </div>
            ))}
          </dl>
          {v.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{v.notes}</p>}
        </div>
      </Content>

      <Content title="Riwayat KM" description="Dari P2H, BBM, trip, servis, dan input manual.">
        <TimeLineChart label="KM" unit="km" data={(odo ?? []).map((o) => ({ date: o.recorded_at, value: o.odometer }))} />
      </Content>

      <Content title="Riwayat">
        <Tabs defaultValue="p2h">
          <TabsList className="flex-wrap">
            <TabsTrigger value="p2h">P2H</TabsTrigger>
            <TabsTrigger value="repairs">Perbaikan</TabsTrigger>
            <TabsTrigger value="services">Servis</TabsTrigger>
            <TabsTrigger value="bookings">Booking</TabsTrigger>
            <TabsTrigger value="fuel">BBM</TabsTrigger>
          </TabsList>
          <TabsContent value="p2h">
            <Rows
              head={["No.", "Waktu", "Jenis", "Driver", "Skor", "Hasil"]}
              rows={(p2h ?? []).map((r) => [
                <Link key="c" href={`/fleet/p2h/history/${r.id}`} className="font-mono text-xs text-primary hover:underline">{r.code}</Link>,
                formatDateTime(r.created_at),
                r.kind === "weekly" ? "Mingguan" : "Pra-perjalanan",
                r.driver_name ?? "-",
                r.score,
                <StatusBadge key="r" map={FLEET_P2H_RESULT} value={r.result} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="repairs">
            <Rows
              head={["No.", "Komponen", "Dilaporkan", "Selesai", "Biaya", "Status"]}
              rows={(repairs ?? []).map((r) => [
                <span key="c" className="font-mono text-xs">{r.code}</span>,
                r.component,
                formatDate(r.created_at),
                formatDate(r.done_at),
                r.actual_cost ? formatCurrency(r.actual_cost) : "-",
                <StatusBadge key="s" map={FLEET_REPAIR_STATUS} value={r.status} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="services">
            <Rows
              head={["Tanggal", "Part", "KM", "Biaya", "Catatan"]}
              rows={(services ?? []).map((r) => [
                formatDate(r.serviced_at),
                (r.part as unknown as { name: string } | null)?.name ?? "Servis berkala",
                r.odometer ? formatNumber(r.odometer) : "-",
                formatCurrency(r.cost),
                r.notes ?? "-",
              ])}
            />
          </TabsContent>
          <TabsContent value="bookings">
            <Rows
              head={["No.", "Berangkat", "Pemohon", "Tujuan", "Status"]}
              rows={(bookings ?? []).map((r) => [
                <Link key="c" href={`/fleet/bookings/${r.id}`} className="font-mono text-xs text-primary hover:underline">{r.code}</Link>,
                formatDateTime(r.start_time),
                r.requester_name ?? "-",
                r.destination ?? "-",
                <StatusBadge key="s" map={FLEET_BOOKING_STATUS} value={r.status} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="fuel">
            <Rows
              head={["Tanggal", "Jarak", "Liter", "km/L", "Biaya", "Rating"]}
              rows={(fuel ?? []).map((r) => [
                formatDate(r.date),
                `${formatNumber(r.distance_km)} km`,
                formatNumber(r.liters, 2),
                formatNumber(r.km_per_liter, 2),
                formatCurrency(r.total_cost),
                <StatusBadge key="r" map={FLEET_FUEL_RATING} value={r.rating} />,
              ])}
            />
          </TabsContent>
        </Tabs>
      </Content>
    </>
  );
}

function Rows({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
