import type { Metadata } from "next";
import Link from "next/link";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { loadPredictionInputs } from "@/lib/fleet/load-prediction";
import { annualPlan } from "@/lib/fleet/prediction";
import { formatCurrency, formatNumber, formatRupiahShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Prediksi Tahunan" };

export default async function AnnualPlanPage() {
  const s = await requireFleet(["admin"]);
  const inputs = await loadPredictionInputs(await getCompanyFilter(s));
  const events = annualPlan(inputs.vehicles, inputs.parts, inputs.usage, inputs.logs, 12);
  const months = new Map<string, { count: number; cost: number }>();
  for (const e of events) {
    const m = months.get(e.month) ?? { count: 0, cost: 0 };
    months.set(e.month, { count: m.count + 1, cost: m.cost + e.cost });
  }
  const monthLabel = (k: string) => new Date(`${k}-01`).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  const total = events.reduce((a, e) => a + e.cost, 0);
  const byVehicle = new Map<string, { plate: string; id: string; count: number; cost: number }>();
  for (const e of events) {
    const v = byVehicle.get(e.vehicle.id) ?? { plate: e.vehicle.plate, id: e.vehicle.id, count: 0, cost: 0 };
    byVehicle.set(e.vehicle.id, { ...v, count: v.count + 1, cost: v.cost + e.cost });
  }

  return (
    <>
      <StatTile label="Estimasi biaya 12 bulan" value={formatRupiahShort(total)} hint="Part & dokumen terjadwal" />
      <StatTile label="Kegiatan servis" value={formatNumber(events.length)} hint={`${inputs.vehicles.length} kendaraan aktif`} />
      <StatTile label="Rata-rata per bulan" value={formatRupiahShort(total / 12)} />
      <StatTile label="Bulan tersibuk" value={[...months.entries()].sort((a, b) => b[1].count - a[1].count)[0] ? monthLabel([...months.entries()].sort((a, b) => b[1].count - a[1].count)[0][0]) : "-"} />
      <Content size="md" title="Biaya per bulan" description="Proyeksi biaya part terjadwal.">
        <HorizontalBarChart label="Biaya" format="rupiah" data={[...months.entries()].map(([k, v]) => ({ name: monthLabel(k), value: v.cost }))} />
      </Content>
      <Content size="md" title="Per kendaraan" description="Urut biaya tertinggi.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kendaraan</TableHead>
              <TableHead className="text-right">Kegiatan</TableHead>
              <TableHead className="text-right">Biaya</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...byVehicle.values()].sort((a, b) => b.cost - a.cost).map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <Link href={`/fleet/vehicles/${v.id}`} className="font-mono text-sm text-primary hover:underline">{v.plate}</Link>
                </TableCell>
                <TableCell className="text-right">{v.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(v.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Content>
      <Content title="Rincian kegiatan">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
              <TableHead>Kendaraan</TableHead>
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Target KM</TableHead>
              <TableHead className="text-right">Biaya</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">{monthLabel(e.month)}</TableCell>
                <TableCell className="font-mono text-sm">{e.vehicle.plate}</TableCell>
                <TableCell>{e.part.name}</TableCell>
                <TableCell className="text-right tabular-nums">{e.targetKm ? formatNumber(e.targetKm) : "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(e.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Content>
    </>
  );
}
