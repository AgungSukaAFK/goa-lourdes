import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { KpiScore } from "@/components/kpi-score";
import { requireGoa } from "@/lib/goa/guard";
import { PERIODS, teamKpi } from "@/lib/goa/server";
import { getCompanyFilter } from "@/lib/company";
import { param, type SearchParams } from "@/lib/list";
import { GOA_PRESENCE, GOA_SP } from "@/lib/status";
import { MODULE_ROLE_LABELS } from "@/lib/types";
import { MemberDialog } from "./member-dialog";

export const metadata: Metadata = { title: "Tim & KPI" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireGoa(["supervisor", "member"]);
  const period = param(sp, "period") || "month";
  const rows = await teamKpi(await getCompanyFilter(s), period);
  const members = rows.map((r) => ({ value: r.member.id, label: r.member.name }));

  return (
    <Content title="Tim & KPI" description={`Skor dihitung dari tugas ${PERIODS.find((p) => p.value === period)?.label ?? ""} terakhir. Atur bobot di Pengaturan KPI.`}>
      <div className="space-y-4">
        <ListFilters search={false} fields={[{ type: "select", key: "period", label: "Periode", options: PERIODS }]} />
        {!rows.length ? (
          <EmptyState icon={UsersRound} title="Belum ada anggota" description="Beri akses GOA (Atasan/Tim) di User Management." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Anggota</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead className="text-right">Selesai</TableHead>
                <TableHead className="text-right">Terbuka</TableHead>
                <TableHead className="text-right">Gagal</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead>Kehadiran</TableHead>
                <TableHead>SP</TableHead>
                {s.isSupervisor && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ member: m, kpi, prev }, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{kpi.score === null ? "-" : i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/goa/team/${m.id}?period=${period}`} className="font-medium hover:underline">{m.name}</Link>
                    <div className="text-xs text-muted-foreground">{m.title ?? (MODULE_ROLE_LABELS.goa as Record<string, string>)[m.role]}</div>
                  </TableCell>
                  <TableCell>
                    <KpiScore score={kpi.score} />
                    {prev?.score != null && kpi.score != null && kpi.score !== prev.score && (
                      <div className="text-xs text-muted-foreground">{kpi.score > prev.score ? "▲" : "▼"} {Math.abs(kpi.score - prev.score)} dari periode lalu</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{kpi.counts.done}</TableCell>
                  <TableCell className="text-right tabular-nums">{kpi.counts.open}</TableCell>
                  <TableCell className="text-right tabular-nums">{kpi.counts.failed}</TableCell>
                  <TableCell className="text-right tabular-nums">{kpi.counts.avgRating ? kpi.counts.avgRating.toFixed(1) : "-"}</TableCell>
                  <TableCell>
                    <StatusBadge map={GOA_PRESENCE} value={m.presence_status} />
                    {m.backup_name && m.presence_status !== "hadir" && <div className="text-xs text-muted-foreground">Backup: {m.backup_name}</div>}
                  </TableCell>
                  <TableCell>{m.sp_level !== "none" ? <StatusBadge map={GOA_SP} value={m.sp_level} /> : <span className="text-muted-foreground">-</span>}</TableCell>
                  {s.isSupervisor && (
                    <TableCell>
                      <MemberDialog member={m} members={members} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Content>
  );
}
