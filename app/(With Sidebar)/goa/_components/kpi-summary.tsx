"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KpiScore } from "@/components/kpi-score";
import { GRADE_RANGES, kpiGrade, type KpiResult } from "@/lib/goa/kpi";

export type KpiRow = { id: string; name: string; title: string | null; kpi: KpiResult };

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint: React.ReactNode }) {
  return (
    <span className="flex h-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{hint}</span>
    </span>
  );
}

function MemberBreakdown({ row, period }: { row: KpiRow; period: string }) {
  const { kpi } = row;
  return (
    <div className="space-y-3 text-sm">
      <KpiScore score={kpi.score} size="lg" />
      <p className="text-xs text-muted-foreground">
        Skor dasar {kpi.raw ?? "-"}
        {kpi.spPenalty ? ` − penalti SP ${kpi.spPenalty}` : ""} · {kpi.counts.closed} tugas ditutup, {kpi.counts.rated} sudah dinilai
      </p>
      <ul className="space-y-2">
        {kpi.params.map((p) => (
          <li key={p.key}>
            <div className="flex justify-between">
              <span>{p.label}</span>
              <span className="font-medium tabular-nums">{p.value ?? "-"}</span>
            </div>
            <p className="text-xs text-muted-foreground">{p.basis}</p>
          </li>
        ))}
      </ul>
      <Link href={`/goa/team/${row.id}?period=${period}`} className="inline-block text-xs text-primary hover:underline">
        Lihat rincian anggota
      </Link>
    </div>
  );
}

/** Rata-rata, tertinggi & terendah KPI tim; setiap kotak membuka rinciannya. */
export function KpiSummary({ rows, period, periodLabel }: { rows: KpiRow[]; period: string; periodLabel: string }) {
  const scored = rows.filter((r) => r.kpi.score !== null).sort((a, b) => (b.kpi.score ?? 0) - (a.kpi.score ?? 0));
  if (!scored.length) return <p className="py-4 text-center text-sm text-muted-foreground">Belum ada anggota dengan tugas yang sudah ditutup.</p>;
  const avg = Math.round(scored.reduce((a, r) => a + (r.kpi.score ?? 0), 0) / scored.length);
  const best = scored[0];
  const low = scored[scored.length - 1];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Dialog>
        <DialogTrigger className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Tile label="Rata-rata KPI tim" value={`${avg} · ${kpiGrade(avg)}`} hint={`${scored.length} anggota dinilai`} />
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rincian rata-rata KPI tim</DialogTitle>
            <DialogDescription>
              {periodLabel}. Dihitung dari anggota yang punya tugas tertutup; anggota tanpa tugas tertutup tidak ikut dirata-rata.
            </DialogDescription>
          </DialogHeader>
          <ol className="divide-y text-sm">
            {scored.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <Link href={`/goa/team/${r.id}?period=${period}`} className="block truncate font-medium hover:underline">{r.name}</Link>
                  <span className="text-xs text-muted-foreground">
                    {r.kpi.counts.done}/{r.kpi.counts.closed} selesai · {r.kpi.counts.rated} dinilai
                  </span>
                </span>
                <KpiScore score={r.kpi.score} />
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-3 gap-1.5 text-xs sm:grid-cols-6">
            {GRADE_RANGES.map((g) => (
              <span key={g.grade} className="rounded-md border px-2 py-1 text-center">
                <span className="font-semibold">{g.grade}</span> <span className="text-muted-foreground">{g.range}</span>
              </span>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {[
        { label: "Top achiever", row: best },
        { label: "KPI terendah", row: low },
      ].map(({ label, row }) => (
        <Dialog key={label}>
          <DialogTrigger className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Tile label={label} value={`${row.kpi.score} · ${kpiGrade(row.kpi.score)}`} hint={row.name} />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {label}: {row.name}
              </DialogTitle>
              <DialogDescription>{[row.title, periodLabel].filter(Boolean).join(" · ")}</DialogDescription>
            </DialogHeader>
            <MemberBreakdown row={row} period={period} />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
