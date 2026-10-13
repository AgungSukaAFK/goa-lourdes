import { notFound } from "next/navigation";
import { DocFooter, DocHeader, DocRows, Signatures } from "@/components/print/doc";
import { requireGoa } from "@/lib/goa/guard";
import { computeKpi, kpiGrade, paramsFor, reviewCoverage, type KpiResult } from "@/lib/goa/kpi";
import { loadKpiSettings, loadTeam } from "@/lib/goa/server";
import { defaultCompanyFor, getCompanyFilter } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { GOA_SP, GOA_TASK_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { GoaTask, TeamMember } from "@/lib/goa/types";

export const metadata = { title: "Rapor KPI" };

const MONTH = /^\d{4}-\d{2}$/;
const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00+07:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const monthOf = (t: GoaTask) => new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7);
const score = (k: KpiResult) => (k.score === null ? "-" : `${k.score} (${kpiGrade(k.score)})`);

function TaskTable({ tasks, showPic }: { tasks: GoaTask[]; showPic?: boolean }) {
  if (!tasks.length) return <p className="text-xs text-neutral-500">Tidak ada tugas.</p>;
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b border-black text-left">
          <th className="py-1 pr-2">Tanggal</th>
          <th className="py-1 pr-2">Tugas</th>
          {showPic && <th className="py-1 pr-2">PIC</th>}
          <th className="py-1 pr-2">Kategori</th>
          <th className="py-1 pr-2">Status</th>
          <th className="py-1 pr-2 text-right">Durasi</th>
          <th className="py-1 text-right">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id} className="border-b border-neutral-300 align-top">
            <td className="whitespace-nowrap py-1 pr-2">{formatDate(t.created_at)}</td>
            <td className="py-1 pr-2">
              {t.title}
              <span className="block font-mono text-[9px] text-neutral-500">{t.code}</span>
            </td>
            {showPic && <td className="py-1 pr-2">{t.assignee_name ?? "General Pool"}</td>}
            <td className="py-1 pr-2">{t.job_category ?? "-"}</td>
            <td className="py-1 pr-2">{GOA_TASK_STATUS[t.is_overdue ? "overdue" : t.status]?.label ?? t.status}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{t.duration_minutes != null ? `${t.duration_minutes} mnt` : "-"}</td>
            <td className="py-1 text-right tabular-nums">{t.rating ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberTable({ rows, tasks }: { rows: { member: TeamMember; kpi: KpiResult }[]; tasks: GoaTask[] }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-black text-left">
          <th className="py-1 pr-2">Nama</th>
          <th className="py-1 pr-2 text-right">KPI</th>
          <th className="py-1 pr-2 text-right">Selesai / ditutup</th>
          <th className="py-1 pr-2 text-right">Terbuka</th>
          <th className="py-1 pr-2 text-right">Rata-rata nilai</th>
          <th className="py-1 pr-2">SP</th>
          <th className="py-1 text-right">Cakupan menilai</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ member: m, kpi }) => {
          const cov = m.role === "supervisor" ? reviewCoverage(m.id, tasks) : null;
          return (
            <tr key={m.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">
                {m.name}
                {m.title && <span className="text-neutral-500"> · {m.title}</span>}
              </td>
              <td className="py-1 pr-2 text-right font-semibold tabular-nums">{score(kpi)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {kpi.counts.done} / {kpi.counts.closed}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{kpi.counts.open}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{kpi.counts.avgRating?.toFixed(1) ?? "-"}</td>
              <td className="py-1 pr-2">{kpi.spPenalty ? `${GOA_SP[m.sp_level]?.label} (−${kpi.spPenalty})` : "-"}</td>
              <td className="py-1 text-right tabular-nums">{cov?.pct != null ? `${cov.pct}% (${cov.rated}/${cov.closed})` : "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function GoaKpiReport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireGoa(["supervisor", "member"]);
  const filter = await getCompanyFilter(s);
  const thisMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7);
  let from = MONTH.test(sp.from ?? "") ? sp.from! : thisMonth;
  let to = MONTH.test(sp.to ?? "") ? sp.to! : from;
  if (to < from) [from, to] = [to, from];
  // Anggota hanya boleh mencetak rapor dirinya sendiri.
  const type = s.isSupervisor && (sp.type === "category" || sp.type === "all") ? sp.type : "member";
  const memberId = s.isSupervisor ? sp.member : s.userId;
  if (type === "member" && !memberId) notFound();
  if (type === "category" && !sp.category) notFound();

  const supabase = await createClient();
  let q = supabase
    .from("goa_tasks_view")
    .select("*")
    .gte("created_at", `${from}-01T00:00:00+07:00`)
    .lt("created_at", `${nextMonth(to)}-01T00:00:00+07:00`)
    .order("created_at")
    .limit(20000);
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  if (type === "member") q = q.eq("assignee_id", memberId!);
  if (type === "category") q = q.eq("job_category", sp.category!);
  const [{ data }, team, settings] = await Promise.all([q, loadTeam(filter), loadKpiSettings()]);
  const tasks = (data ?? []) as GoaTask[];

  const months: string[] = [];
  for (let m = from; m <= to; m = nextMonth(m)) months.push(m);
  const period = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
  const kpiOf = (m: TeamMember, list: GoaTask[]) => computeKpi(m, list.filter((t) => t.assignee_id === m.id), paramsFor(m.id, settings));
  const company = defaultCompanyFor(s, filter);
  const number = `${type === "member" ? "IND" : type === "category" ? "KAT" : "ALL"}-${from.replace("-", "")}${to !== from ? `-${to.replace("-", "")}` : ""}`;

  if (type === "member") {
    const m = team.find((x) => x.id === memberId);
    if (!m) notFound();
    const kpi = kpiOf(m, tasks);
    return (
      <article className="space-y-6 text-sm">
        <DocHeader company={company} title="Rapor Penilaian Kinerja" number={number} />
        <DocRows
          rows={[
            ["Nama", m.name],
            ["Jabatan", [m.title, m.position].filter(Boolean).join(" · ") || "-"],
            ["NRP", m.nrp ?? "-"],
            ["Periode", period],
            ["Skor KPI", <strong key="s">{score(kpi)}</strong>],
            ["Skor dasar", `${kpi.raw ?? "-"}${kpi.spPenalty ? ` − penalti ${GOA_SP[m.sp_level]?.label} ${kpi.spPenalty}` : ""}`],
            ["Tugas", `${kpi.counts.total} total · ${kpi.counts.done} selesai · ${kpi.counts.failed} tidak selesai/hangus · ${kpi.counts.open} terbuka`],
          ]}
        />
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase">Parameter KPI</h2>
          <DocRows rows={kpi.params.map((p) => [`${p.label} (bobot ${p.weight})`, `${p.value ?? "-"} · ${p.basis}`])} />
        </section>
        {months.map((mo) => {
          const list = tasks.filter((t) => monthOf(t) === mo);
          const k = kpiOf(m, list);
          return (
            <section key={mo} className="break-inside-avoid-page">
              <h2 className="mb-1 flex justify-between border-b border-black text-sm font-semibold uppercase">
                <span>{monthLabel(mo)}</span>
                <span className="normal-case">KPI {score(k)}</span>
              </h2>
              <TaskTable tasks={list} />
            </section>
          );
        })}
        <Signatures items={[{ role: "Karyawan", name: m.name }, { role: "Atasan" }]} />
        <DocFooter />
      </article>
    );
  }

  const members = team.filter((m) => m.role !== "guest");
  const rowsFor = (list: GoaTask[]) =>
    members
      .map((m) => ({ member: m, kpi: kpiOf(m, list) }))
      .filter((r) => r.kpi.counts.total > 0 || (type === "all" && r.member.role === "supervisor" && reviewCoverage(r.member.id, list).closed > 0))
      .sort((a, b) => (b.kpi.score ?? -1) - (a.kpi.score ?? -1));
  const all = rowsFor(tasks);
  const scored = all.filter((r) => r.member.role === "member" && r.kpi.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.kpi.score ?? 0), 0) / scored.length) : null;

  return (
    <article className="space-y-6 text-sm">
      <DocHeader company={company} title={type === "category" ? "Rapor Kategori Pekerjaan" : "Rapor Kinerja Tim"} number={number} />
      <DocRows
        rows={[
          ...(type === "category" ? ([["Kategori", sp.category]] as [string, React.ReactNode][]) : []),
          ["Periode", period],
          ["Jumlah tugas", `${tasks.length} (${tasks.filter((t) => t.status === "done").length} selesai)`],
          ["Rata-rata KPI tim", avg === null ? "-" : `${avg} (${kpiGrade(avg)})`],
        ]}
      />
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase">Ringkasan per anggota</h2>
        {all.length ? <MemberTable rows={all} tasks={tasks} /> : <p className="text-xs text-neutral-500">Tidak ada data.</p>}
        <p className="mt-1 text-[10px] text-neutral-500">
          KPI{type === "category" ? " dihitung dari tugas kategori ini saja" : ""}. Cakupan menilai = tugas tertutup yang di-review atasan dan sudah diberi nilai.
        </p>
      </section>
      {months.map((mo) => {
        const list = tasks.filter((t) => monthOf(t) === mo);
        const cats = new Map<string, number>();
        for (const t of list) cats.set(t.job_category ?? "Tidak dikategorikan", (cats.get(t.job_category ?? "Tidak dikategorikan") ?? 0) + 1);
        return (
          <section key={mo} className="break-inside-avoid-page space-y-2">
            <h2 className="border-b border-black text-sm font-semibold uppercase">{monthLabel(mo)}</h2>
            {type === "category" ? (
              <TaskTable tasks={list} showPic />
            ) : (
              <>
                <MemberTable rows={rowsFor(list)} tasks={list} />
                <p className="text-[11px]">
                  {[...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(" · ") || "Tidak ada tugas."}
                </p>
              </>
            )}
          </section>
        );
      })}
      <Signatures items={[{ role: "Dibuat oleh", name: s.profile.name }, { role: "Mengetahui" }]} />
      <DocFooter />
    </article>
  );
}
