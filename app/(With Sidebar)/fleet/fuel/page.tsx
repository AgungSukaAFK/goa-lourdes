import type { Metadata } from "next";
import { Fuel } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart-card";
import { requireFleet } from "@/lib/fleet/guard";
import { loadFleetOptions } from "@/lib/fleet/server";
import { getCompanyFilter } from "@/lib/company";
import { pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { FLEET_FUEL_RATING } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatNumber, formatRupiahShort } from "@/lib/utils";
import { FuelDelete, FuelFormDialog } from "./fuel-form";

export const metadata: Metadata = { title: "Rasio BBM" };

const SORTS = { date: { column: "date" }, ratio: { column: "km_per_liter" }, cost: { column: "total_cost" } };

export default async function FuelPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireFleet(["admin", "driver"]);
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "date.desc");
  const supabase = await createClient();
  let query = supabase.from("fleet_fuel_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (!s.isAdmin) query = query.eq("driver_id", s.myDriverId ?? "00000000-0000-0000-0000-000000000000");
  for (const k of ["vehicle_id", "rating"]) {
    const v = param(sp, k);
    if (v) query = query.eq(k, v);
  }
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";
  let mq = supabase.from("fleet_fuel_view").select("vehicle_id, vehicle_plate, distance_km, liters, total_cost").gte("date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  if (filter) mq = mq.eq("company", filter);
  const [{ data, count }, options, { data: recent }, { data: thisMonth }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    loadFleetOptions(),
    mq,
    supabase.from("fleet_fuel_logs").select("total_cost, liters").gte("date", monthStart),
  ]);
  const agg = new Map<string, { plate: string; km: number; l: number }>();
  for (const r of recent ?? []) {
    const a = agg.get(r.vehicle_id) ?? { plate: r.vehicle_plate, km: 0, l: 0 };
    agg.set(r.vehicle_id, { plate: r.vehicle_plate, km: a.km + Number(r.distance_km), l: a.l + Number(r.liters) });
  }
  const perVehicle = [...agg.values()].filter((a) => a.l > 0).map((a) => ({ name: a.plate, value: Math.round((a.km / a.l) * 10) / 10 }));
  const totalKm = [...agg.values()].reduce((x, a) => x + a.km, 0);
  const totalL = [...agg.values()].reduce((x, a) => x + a.l, 0);
  const monthCost = (thisMonth ?? []).reduce((x, r) => x + Number(r.total_cost), 0);
  const monthL = (thisMonth ?? []).reduce((x, r) => x + Number(r.liters), 0);

  return (
    <>
      {s.isAdmin && (
        <>
          <StatTile label="Rata-rata armada (90 hari)" value={totalL ? `${formatNumber(totalKm / totalL, 1)} km/L` : "-"} />
          <StatTile label="Biaya BBM bulan ini" value={formatRupiahShort(monthCost)} hint={`${formatNumber(monthL, 0)} liter`} />
        </>
      )}
      <Content
        title="Rasio BBM"
        description="≥ 15 km/L sangat irit · 10–15 irit · 7–10 cukup · < 7 boros."
        cardAction={<FuelFormDialog vehicles={options.vehicles} drivers={options.drivers} isAdmin={s.isAdmin} />}
      >
        <div className="space-y-4">
          <ListFilters
            searchPlaceholder="Cari..."
            fields={[
              { type: "select", key: "vehicle_id", label: "Kendaraan", options: options.vehicles },
              { type: "select", key: "rating", label: "Rating", options: Object.entries(FLEET_FUEL_RATING).map(([value, d]) => ({ value, label: d.label })) },
            ]}
          />
          {!data?.length ? (
            <EmptyState icon={Fuel} title="Belum ada data BBM" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="date" defaultDirection="desc">Tanggal</SortHead>
                  <TableHead>Kendaraan</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Jarak</TableHead>
                  <TableHead className="text-right">Liter</TableHead>
                  <SortHead k="ratio" defaultDirection="desc" className="text-right">km/L</SortHead>
                  <SortHead k="cost" defaultDirection="desc" className="text-right">Biaya</SortHead>
                  <TableHead className="text-right">Rp/km</TableHead>
                  <TableHead>Rating</TableHead>
                  {s.isAdmin && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-mono text-sm">{r.vehicle_plate}</TableCell>
                    <TableCell>{r.driver_name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.distance_km)} km</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.liters, 2)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatNumber(r.km_per_liter, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.total_cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cost_per_km ? formatCurrency(r.cost_per_km) : "-"}</TableCell>
                    <TableCell><StatusBadge map={FLEET_FUEL_RATING} value={r.rating} /></TableCell>
                    {s.isAdmin && <TableCell><FuelDelete id={r.id} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
        </div>
      </Content>
      {s.isAdmin && perVehicle.length > 0 && (
        <Content title="Rata-rata km/L per kendaraan" description="90 hari terakhir. Makin panjang makin irit.">
          <HorizontalBarChart label="km/L" data={perVehicle.sort((a, b) => b.value - a.value)} />
        </Content>
      )}
    </>
  );
}
