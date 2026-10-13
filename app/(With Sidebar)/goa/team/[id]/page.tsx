import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Content } from "@/components/content";
import { StatusBadge } from "@/components/status-badge";
import { KpiScore } from "@/components/kpi-score";
import { InsightList } from "@/components/insight-list";
import { TimeLineChart } from "@/components/dashboard/line-chart";
import { requireGoa } from "@/lib/goa/guard";
import { computeKpi, insightsFor, paramsFor } from "@/lib/goa/kpi";
import { loadKpiSettings, loadTeam, PERIODS, periodStart } from "@/lib/goa/server";
import { createClient } from "@/lib/supabase/server";
import { GOA_PRESENCE, GOA_SP, GOA_TASK_STATUS } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { GoaTask } from "@/lib/goa/types";

export const metadata: Metadata = { title: "Detail Anggota" };

export default async function MemberDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const period = (await searchParams).period || "month";
  const s = await requireGoa(["supervisor", "member"]);
  const [team, settings] = await Promise.all([loadTeam(null), loadKpiSettings()]);
  const m = team.find((x) => x.id === id);
  if (!m) notFound();

  const supabase = await createClient();
  const since = new Date(Math.min(periodStart(period).getTime(), Date.now() - 56 * 86400000));
  const { data } = await supabase.from("goa_tasks_view").select("*").eq("assignee_id", id).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(5000);
  const tasks = (data ?? []) as GoaTask[];
  const prm = paramsFor(id, settings);
  const start = periodStart(period);
  const cur = tasks.filter((t) => new Date(t.created_at) >= start);
  const kpi = computeKpi(m, cur, prm);
  const prevStart = new Date(start.getTime() - (Date.now() - start.getTime()));
  const prevTasks = tasks.filter((t) => new Date(t.created_at) < start && new Date(t.created_at) >= prevStart);
  const insights = insightsFor(kpi, prevTasks.length ? computeKpi(m, prevTasks, prm) : null);

  // Tren 8 minggu (KPI per minggu, tanpa penalti SP supaya terlihat performa murni)
  const trend = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * 86400000;
    const begin = end - 7 * 86400000;
    const wk = tasks.filter((t) => {
      const c = new Date(t.created_at).getTime();
      return c >= begin && c < end;
    });
    return { date: new Date(end).toISOString(), value: computeKpi({ sp_level: "none", sp_date: null }, wk, prm).raw };
  }).filter((x): x is { date: string; value: number } => x.value !== null);

  return (
    <>
      <Content size="sm" title={m.name} description={[m.title, m.position].filter(Boolean).join(" · ") || undefined}>
        <div className="space-y-4">
          <KpiScore score={kpi.score} size="lg" />
          <p className="text-xs text-muted-foreground">
            Periode {PERIODS.find((p) => p.value === period)?.label} · skor dasar {kpi.raw ?? "-"}
            {kpi.spPenalty ? ` − SP ${kpi.spPenalty}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge map={GOA_PRESENCE} value={m.presence_status} />
            {m.sp_level !== "none" && <StatusBadge map={GOA_SP} value={m.sp_level} />}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ["Tugas", kpi.counts.total],
                ["Selesai", kpi.counts.done],
                ["Terbuka", kpi.counts.open],
                ["Gagal/hangus", kpi.counts.failed],
                ["Rata-rata nilai", kpi.counts.avgRating?.toFixed(1) ?? "-"],
                ["Bergabung", formatDate(m.join_date)],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Content>
      <Content size="sm" title="Parameter KPI" description="Nilai × bobot. Parameter tanpa data tidak dihitung.">
        <ul className="space-y-3">
          {kpi.params.map((p) => (
            <li key={p.key}>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {p.label} <span className="text-xs text-muted-foreground">×{p.weight}</span>
                </span>
                <span className="font-medium tabular-nums">{p.value ?? "-"}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.value ?? 0}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.basis}</p>
            </li>
          ))}
        </ul>
      </Content>
      <Content size="sm" title="Saran performa">
        <InsightList items={insights} />
      </Content>
      <Content size="md" title="Tren KPI mingguan" description="8 minggu terakhir, sebelum penalti SP.">
        <TimeLineChart label="KPI" data={trend} domain={[0, 100]} />
      </Content>
      <Content size="md" title="Tugas terbaru">
        <ul className="divide-y text-sm">
          {cur.slice(0, 12).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}{t.rating ? ` · nilai ${t.rating}` : ""}</p>
              </div>
              <StatusBadge map={GOA_TASK_STATUS} value={t.is_overdue ? "overdue" : t.status} />
            </li>
          ))}
          {!cur.length && <li className="py-6 text-center text-muted-foreground">Belum ada tugas.</li>}
        </ul>
      </Content>
    </>
  );
}
