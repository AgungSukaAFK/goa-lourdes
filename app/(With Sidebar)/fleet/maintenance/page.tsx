import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { ToneBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { loadPredictionInputs } from "@/lib/fleet/load-prediction";
import { annualPlan, predict } from "@/lib/fleet/prediction";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { MonthCalendar } from "./month-calendar";

export const metadata: Metadata = { title: "Prediksi Servis" };

const CONF = { high: { label: "Tinggi", tone: "green" }, medium: { label: "Sedang", tone: "amber" }, low: { label: "Rendah", tone: "gray" } } as const;

export default async function MaintenancePage() {
  const s = await requireFleet(["admin"]);
  const inputs = await loadPredictionInputs(await getCompanyFilter(s));
  const preds = predict(inputs.vehicles, inputs.parts, inputs.usage, inputs.logs).filter((p) => p.daysLeft <= 60);
  const events = annualPlan(inputs.vehicles, inputs.parts, inputs.usage, inputs.logs, 6).map((e) => ({
    date: e.date.toLocaleDateString("en-CA"),
    plate: e.vehicle.plate,
    part: e.part.name,
    cost: e.cost,
  }));

  return (
    <>
      <Content
        title="Servis 60 hari ke depan"
        description="Dihitung dari KM saat ini, rata-rata km/hari (log 90 hari), dan riwayat servis per part. Keyakinan rendah = data KM belum cukup, memakai asumsi 150 km/hari."
      >
        {!preds.length ? (
          <EmptyState icon={CalendarRange} title="Tidak ada servis jatuh tempo dalam 60 hari" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Perkiraan</TableHead>
                <TableHead className="text-right">Target / sisa</TableHead>
                <TableHead className="text-right">Biaya</TableHead>
                <TableHead>Keyakinan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preds.map((p, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Link href={`/fleet/vehicles/${p.vehicle.id}`} className="font-mono text-sm text-primary hover:underline">{p.vehicle.plate}</Link>
                    <div className="text-xs text-muted-foreground">{p.vehicle.model}</div>
                  </TableCell>
                  <TableCell>{p.part.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(p.dueDate)}
                    <div className="mt-0.5">
                      {p.daysLeft < 0 ? (
                        <ToneBadge tone="red" className="text-[10px]">Lewat {Math.abs(p.daysLeft)} hari</ToneBadge>
                      ) : p.daysLeft <= 7 ? (
                        <ToneBadge tone="amber" className="text-[10px]">{p.daysLeft} hari lagi</ToneBadge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{p.daysLeft} hari lagi</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {p.targetKm !== undefined ? (
                      <>
                        {formatNumber(p.targetKm)} km
                        <div className="text-xs text-muted-foreground">
                          sisa {formatNumber(p.remainingKm)} km · {formatNumber(p.avgKmPerDay)} km/hari
                        </div>
                      </>
                    ) : (
                      "Tanggal dokumen"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.part.cost)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={CONF[p.confidence].tone}>{CONF[p.confidence].label}</ToneBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Content>
      <Content title="Kalender servis" description="Proyeksi 6 bulan. Atur daftar part & interval di Pengaturan Fleet.">
        <MonthCalendar events={events} />
      </Content>
    </>
  );
}
