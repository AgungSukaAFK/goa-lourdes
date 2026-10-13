import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { FLEET_P2H_RESULT } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/fleet/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Jadwal P2H" };

export default async function P2hSchedule() {
  const s = await requireFleet(["admin"]);
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  let vq = supabase.from("fleet_vehicles").select("id, plate, model, company, status").neq("status", "inactive").order("plate");
  if (filter) vq = vq.eq("company", filter);
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const [{ data: vehicles }, { data: p2h }] = await Promise.all([
    vq,
    supabase.from("fleet_p2h_inspections").select("id, vehicle_id, kind, created_at, result, next_due_date").gte("created_at", since).order("created_at", { ascending: false }),
  ]);

  const rows = (vehicles ?? []).map((v) => {
    const mine = (p2h ?? []).filter((x) => x.vehicle_id === v.id);
    const weekly = mine.find((x) => x.kind === "weekly");
    const last = mine[0];
    const due = weekly?.next_due_date ?? null;
    const d = daysUntil(due);
    const state = !weekly ? "never" : d! < 0 ? "overdue" : d! <= 1 ? "due" : "ok";
    return { v, weekly, last, due, d, state };
  });
  const order = { overdue: 0, never: 1, due: 2, ok: 3 };
  rows.sort((a, b) => order[a.state as keyof typeof order] - order[b.state as keyof typeof order]);
  const count = (st: string) => rows.filter((r) => r.state === st).length;

  return (
    <>
      <StatTile label="Kendaraan aktif" value={rows.length} />
      <StatTile label="P2H mingguan terlambat" value={count("overdue")} attention={count("overdue") > 0} hint="Lewat 7 hari sejak P2H terakhir" />
      <StatTile label="Belum pernah P2H mingguan" value={count("never")} hint="60 hari terakhir" />
      <StatTile label="Patuh" value={count("ok") + count("due")} hint={`${count("due")} jatuh tempo hari ini/besok`} />
      <Content title="Kepatuhan P2H mingguan" description="Setiap kendaraan wajib P2H rutin tiap 7 hari, selain P2H pra-perjalanan.">
        {!rows.length ? (
          <EmptyState icon={ClipboardList} title="Belum ada kendaraan" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kendaraan</TableHead>
                <TableHead>P2H mingguan terakhir</TableHead>
                <TableHead>Jatuh tempo berikut</TableHead>
                <TableHead>P2H terakhir (semua)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ v, weekly, last, due, d, state }) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/fleet/vehicles/${v.id}`} className="font-mono text-sm text-primary hover:underline">{v.plate}</Link>
                    <div className="text-xs text-muted-foreground">{v.model}</div>
                  </TableCell>
                  <TableCell className="text-sm">{weekly ? formatDateTime(weekly.created_at) : "-"}</TableCell>
                  <TableCell className="text-sm">{due ? formatDate(due) : "-"}</TableCell>
                  <TableCell>
                    {last ? (
                      <Link href={`/fleet/p2h/history/${last.id}`} className="inline-flex items-center gap-2 text-sm hover:underline">
                        {formatDate(last.created_at)} <StatusBadge map={FLEET_P2H_RESULT} value={last.result} />
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {state === "overdue" ? (
                      <ToneBadge tone="red">Terlambat {Math.abs(d!)} hari</ToneBadge>
                    ) : state === "never" ? (
                      <ToneBadge tone="orange">Belum ada</ToneBadge>
                    ) : state === "due" ? (
                      <ToneBadge tone="amber">Jatuh tempo</ToneBadge>
                    ) : (
                      <ToneBadge tone="green">Patuh</ToneBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Content>
    </>
  );
}
