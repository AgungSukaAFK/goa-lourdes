import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CheckCircle2, ClipboardList, Inbox, Loader } from "lucide-react";
import { Content } from "@/components/content";
import { StatTile } from "@/components/dashboard/stat-tile";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart-card";
import { StatusBreakdown } from "@/components/dashboard/breakdown-list";
import { KpiScore } from "@/components/kpi-score";
import { requireGoa } from "@/lib/goa/guard";
import { teamKpi } from "@/lib/goa/server";
import { getCompanyFilter } from "@/lib/company";
import { GOA_TASK_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard GOA" };

export default async function GoaDashboard() {
  const s = await requireGoa();
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  const startToday = `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}T00:00:00+07:00`;
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  let q = supabase
    .from("goa_tasks_view")
    .select("id, status, assignee_id, assignee_name, job_category, is_overdue, completed_at, created_at")
    .or(`status.in.(pending,in_progress),created_at.gte.${week},completed_at.gte.${week}`)
    .limit(10000);
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  const [{ data }, ranking] = await Promise.all([q, teamKpi(filter, "month")]);
  const tasks = data ?? [];
  const open = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const doneToday = tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= new Date(startToday).toISOString());
  const pool = open.filter((t) => !t.assignee_id);

  const workload = new Map<string, number>();
  for (const t of open) workload.set(t.assignee_name ?? "General Pool", (workload.get(t.assignee_name ?? "General Pool") ?? 0) + 1);
  const statusWeek: Record<string, number> = {};
  for (const t of tasks.filter((t) => t.created_at >= week)) statusWeek[t.status] = (statusWeek[t.status] ?? 0) + 1;
  const cats = new Map<string, number>();
  for (const t of tasks.filter((t) => t.created_at >= week)) cats.set(t.job_category ?? "Lainnya", (cats.get(t.job_category ?? "Lainnya") ?? 0) + 1);

  return (
    <>
      <StatTile label="Tugas terbuka" value={formatNumber(open.length)} icon={ClipboardList} href="/goa/board" hint={`${open.filter((t) => t.status === "in_progress").length} sedang dikerjakan`} />
      <StatTile label="General Pool" value={formatNumber(pool.length)} icon={Inbox} href="/goa/my-tasks" attention={pool.length > 0} hint="Belum ada PIC, bisa diambil" />
      <StatTile label="Selesai hari ini" value={formatNumber(doneToday.length)} icon={CheckCircle2} />
      <StatTile
        label="Lewat batas"
        value={formatNumber(open.filter((t) => t.is_overdue).length)}
        icon={open.some((t) => t.is_overdue) ? AlarmClock : Loader}
        href="/goa/tasks?status=overdue"
        attention={open.some((t) => t.is_overdue)}
        hint="Masih terbuka"
      />

      <Content size="md" title="Beban kerja" description="Tugas terbuka per PIC.">
        <HorizontalBarChart label="Tugas" data={[...workload.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)} />
      </Content>
      <Content size="md" title="Status tugas 7 hari">
        <StatusBreakdown map={GOA_TASK_STATUS} counts={statusWeek} hrefFor={(st) => `/goa/tasks?status=${st}`} />
      </Content>
      <Content size="md" title="Peringkat KPI" description="30 hari terakhir.">
        {ranking.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada anggota tim.</p>
        ) : (
          <ol className="space-y-2">
            {ranking.slice(0, 8).map((r, i) => (
              <li key={r.member.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{r.kpi.score === null ? "-" : i + 1}</span>
                  <Link href={`/goa/team/${r.member.id}`} className="truncate hover:underline">{r.member.name}</Link>
                </span>
                <KpiScore score={r.kpi.score} />
              </li>
            ))}
          </ol>
        )}
      </Content>
      <Content size="md" title="Kategori pekerjaan 7 hari">
        <HorizontalBarChart label="Tugas" data={[...cats.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)} />
      </Content>
    </>
  );
}
