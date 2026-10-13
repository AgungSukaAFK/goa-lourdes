import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Content } from "@/components/content";
import { ListFilters } from "@/components/list/list-filters";
import { EmptyState } from "@/components/list/empty-state";
import { KpiScore } from "@/components/kpi-score";
import { InsightList } from "@/components/insight-list";
import { requireGoa } from "@/lib/goa/guard";
import { insightsFor } from "@/lib/goa/kpi";
import { PERIODS, teamKpi } from "@/lib/goa/server";
import { getCompanyFilter } from "@/lib/company";
import { param, type SearchParams } from "@/lib/list";

export const metadata: Metadata = { title: "Saran Performa" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireGoa(["supervisor", "member"]);
  const period = param(sp, "period") || "month";
  let rows = await teamKpi(await getCompanyFilter(s), period);
  // Anggota hanya melihat saran untuk dirinya; atasan melihat semua.
  if (!s.isSupervisor) rows = rows.filter((r) => r.member.id === s.userId);

  const team = rows.filter((r) => r.kpi.score !== null);
  const avg = team.length ? Math.round(team.reduce((a, r) => a + (r.kpi.score ?? 0), 0) / team.length) : null;
  const unrated = rows.reduce((a, r) => a + (r.kpi.counts.done - r.kpi.counts.rated), 0);

  return (
    <>
      <Content
        title="Saran Performa"
        description="Saran dihitung dengan aturan dari data tugas (bukan model AI), dan setiap saran menyebut angka dasarnya."
      >
        <div className="space-y-3">
          <ListFilters search={false} fields={[{ type: "select", key: "period", label: "Periode", options: PERIODS }]} />
          {s.isSupervisor && (
            <p className="text-sm text-muted-foreground">
              Rata-rata KPI tim: <span className="font-medium text-foreground">{avg ?? "-"}</span>
              {unrated > 0 && ` · ${unrated} tugas selesai belum dinilai`}
            </p>
          )}
        </div>
      </Content>
      {!rows.length && (
        <Content>
          <EmptyState icon={Lightbulb} title="Belum ada data" />
        </Content>
      )}
      {rows.map((r) => (
        <Content
          key={r.member.id}
          size="md"
          title={r.member.name}
          description={r.member.title ?? undefined}
          cardAction={<KpiScore score={r.kpi.score} />}
        >
          <InsightList items={insightsFor(r.kpi, r.prev)} />
          <Link href={`/goa/team/${r.member.id}?period=${period}`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Lihat rincian
          </Link>
        </Content>
      ))}
    </>
  );
}
