import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { FLEET_P2H_RESULT } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Riwayat P2H" };

const SORTS = { created: { column: "created_at" }, score: { column: "score" } };

export default async function P2hHistory({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireFleet(["admin", "driver"]);
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const supabase = await createClient();
  let query = supabase.from("fleet_p2h_view").select("id, code, created_at, kind, vehicle_plate, vehicle_model, driver_name, odometer, score, result, issues", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (!s.isAdmin) query = query.eq("driver_id", s.myDriverId ?? "00000000-0000-0000-0000-000000000000");
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},vehicle_plate.ilike.${t},driver_name.ilike.${t}`);
  }
  for (const k of ["result", "kind"]) {
    const v = param(sp, k);
    if (v) query = query.eq(k, v);
  }
  const date = param(sp, "date");
  if (date) query = query.gte("created_at", `${date}T00:00:00+07:00`).lte("created_at", `${date}T23:59:59+07:00`);
  const { data, count } = await query.order(sort.column, { ascending: sort.ascending }).range(from, to);

  return (
    <Content title="Riwayat P2H" description={s.isAdmin ? "Semua pemeriksaan harian & mingguan." : "P2H yang Anda isi."}>
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no., plat, driver..."
          fields={[
            { type: "select", key: "result", label: "Hasil", options: Object.entries(FLEET_P2H_RESULT).map(([value, d]) => ({ value, label: d.label })) },
            { type: "select", key: "kind", label: "Jenis", options: [{ value: "pre_trip", label: "Pra-perjalanan" }, { value: "weekly", label: "Mingguan" }] },
            { type: "date", key: "date", label: "Tanggal" },
          ]}
        />
        {!data?.length ? (
          <EmptyState icon={History} title="Belum ada P2H" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <SortHead k="created" defaultDirection="desc">Waktu</SortHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <SortHead k="score" className="text-right">Skor</SortHead>
                <TableHead>Hasil</TableHead>
                <TableHead>Temuan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/fleet/p2h/history/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {r.code}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.kind === "weekly" ? "Mingguan" : "Pra-perjalanan"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{r.vehicle_plate}</div>
                    <div className="text-xs text-muted-foreground">{r.vehicle_model}</div>
                  </TableCell>
                  <TableCell>{r.driver_name ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.odometer)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{r.score}</TableCell>
                  <TableCell><StatusBadge map={FLEET_P2H_RESULT} value={r.result} /></TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={(r.issues ?? []).join(", ")}>
                    {(r.issues ?? []).length ? (r.issues as string[]).join(", ") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
      </div>
    </Content>
  );
}
