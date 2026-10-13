import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { Content } from "@/components/content";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ListFilters } from "@/components/list/list-filters";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireGoa } from "@/lib/goa/guard";
import { loadTeam } from "@/lib/goa/server";
import { HOURS_PER_DAY, MAX_TASK_MINUTES, WORKLOAD_STATUS, summarizeWorkload, workloadRange, type WorkloadPeriod } from "@/lib/goa/workload";
import { getCompanyFilter } from "@/lib/company";
import { param, type SearchParams } from "@/lib/list";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Beban Kerja (WLA)" };

const PERIODS = [
  { value: "month", label: "Bulanan" },
  { value: "week", label: "Mingguan" },
];

const hours = (h: number) => `${h.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;

export default async function WorkloadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireGoa(["supervisor", "member"]);
  const filter = await getCompanyFilter(s);
  const period: WorkloadPeriod = param(sp, "period") === "week" ? "week" : "month";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "date") ?? "") ? (param(sp, "date") as string) : today;

  const supabase = await createClient();
  const { data: hol } = await supabase.from("holidays").select("date").gte("date", `${date.slice(0, 4)}-01-01`).lte("date", `${Number(date.slice(0, 4)) + 1}-01-31`);
  const range = workloadRange(period, date, new Set((hol ?? []).map((h) => h.date as string)));

  let q = supabase
    .from("goa_tasks_view")
    .select("id, assignee_id, duration_minutes")
    .in("status", ["done", "undone", "expired"])
    .not("assignee_id", "is", null)
    .gte("completed_at", `${range.start}T00:00:00+07:00`)
    .lt("completed_at", `${range.end}T00:00:00+07:00`)
    .limit(20000);
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  // Anggota hanya melihat beban kerjanya sendiri; atasan melihat seluruh tim.
  if (!s.isSupervisor) q = q.eq("assignee_id", s.userId);
  const [{ data }, team] = await Promise.all([q, loadTeam(filter)]);
  const tasks = data ?? [];

  const rows = team
    .filter((m) => m.role !== "guest" && (s.isSupervisor || m.id === s.userId))
    .map((m) => ({ member: m, ...summarizeWorkload(tasks.filter((t) => t.assignee_id === m.id), range.capacityHours, range.workdays) }))
    // Atasan tanpa tugas tercatat tidak ikut ditampilkan (biasanya hanya mereview).
    .filter((r) => r.member.role === "member" || r.tasks > 0)
    .sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1) || a.member.name.localeCompare(b.member.name, "id"));
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const totalHours = rows.reduce((a, r) => a + r.hours, 0);
  const capped = rows.reduce((a, r) => a + r.capped, 0);

  return (
    <>
      <Content
        title="Analisis Beban Kerja (WLA)"
        description={`${formatDate(range.start)} – ${formatDate(range.last)} · ${range.workdays} hari kerja × ${HOURS_PER_DAY} jam = kapasitas ${range.capacityHours} jam per orang`}
      >
        <ListFilters
          search={false}
          fields={[
            { type: "select", key: "period", label: "Periode", options: PERIODS },
            { type: "date", key: "date", label: "Tanggal acuan" },
          ]}
        />
      </Content>
      <StatTile label="Total jam tercatat" value={hours(totalHours)} hint={`${formatNumber(tasks.length)} tugas ditutup`} />
      <StatTile label="Kurang manpower" value={count("over")} hint="Utilisasi di atas 100%" attention={count("over") > 0} />
      <StatTile label="Ideal" value={count("ideal")} hint="Utilisasi 80–100%" />
      <StatTile label="Lebih manpower" value={count("under")} hint="Utilisasi di bawah 80%" />

      <Content title="Per manpower" description="Jam kerja = durasi tugas yang ditutup di periode ini (dari Mulai sampai Selesai/Tidak selesai).">
        {!rows.length ? (
          <EmptyState icon={Gauge} title="Belum ada anggota tim" />
        ) : (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manpower</TableHead>
                  <TableHead className="text-right">Tugas</TableHead>
                  <TableHead className="text-right">Total jam</TableHead>
                  <TableHead className="text-right">Rata-rata/hari kerja</TableHead>
                  <TableHead>Utilisasi</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.member.id}>
                    <TableCell>
                      <Link href={`/goa/team/${r.member.id}`} className="font-medium hover:underline">{r.member.name}</Link>
                      {r.member.title && <div className="text-xs text-muted-foreground">{r.member.title}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.counted}
                      {r.tasks > r.counted && <span className="text-xs text-muted-foreground"> / {r.tasks}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{hours(r.hours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{hours(r.perDay)}</TableCell>
                    <TableCell>
                      {r.utilization === null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-sm font-medium tabular-nums">{r.utilization}%</span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.utilization)}%` }} />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge map={WORKLOAD_STATUS} value={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Tugas tanpa durasi (langsung ditutup tanpa Mulai) tidak dihitung; angka &quot;/ n&quot; menunjukkan jumlah semua tugas yang ditutup.
              Durasi satu tugas dibatasi {MAX_TASK_MINUTES / 60} jam supaya tugas yang lupa ditutup tidak menggelembungkan beban
              {capped > 0 && ` (${capped} tugas terkena batas ini)`}.
            </p>
          </div>
        )}
      </Content>
    </>
  );
}
