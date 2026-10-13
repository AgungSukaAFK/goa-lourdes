import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { FLEET_REPAIR_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RepairRowActions, ReportRepairDialog } from "./repair-dialogs";

export const metadata: Metadata = { title: "Daftar Perbaikan" };

const SORTS = { created: { column: "created_at" }, cost: { column: "actual_cost" } };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireFleet(["admin"]);
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const status = param(sp, "status") || "open";
  const supabase = await createClient();
  let query = supabase.from("fleet_repairs_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) query = query.or(`code.ilike.${ilikeTerm(q)},component.ilike.${ilikeTerm(q)},vehicle_plate.ilike.${ilikeTerm(q)}`);
  if (status === "open") query = query.in("status", ["queued", "in_progress"]);
  else if (status !== "all") query = query.eq("status", status);
  const vehicle = param(sp, "vehicle");
  if (vehicle) query = query.eq("vehicle_id", vehicle);
  const [{ data, count }, { data: vehicles }, { data: parts }, { data: costRows }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    supabase.from("fleet_vehicles").select("id, plate, model").neq("status", "inactive").order("plate"),
    supabase.from("fleet_parts").select("id, name").eq("is_active", true).order("name"),
    supabase.from("fleet_repairs").select("actual_cost").eq("status", "done").gte("done_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  const vehicleOpts = (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.plate} · ${v.model}` }));
  const monthCost = (costRows ?? []).reduce((a, r) => a + Number(r.actual_cost ?? 0), 0);

  return (
    <Content
      title="Daftar Perbaikan"
      description={`Dari temuan P2H & laporan manual. Biaya bulan ini: ${formatCurrency(monthCost)}.`}
      cardAction={<ReportRepairDialog vehicles={vehicleOpts} />}
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no., komponen, plat..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "open", label: "Belum selesai (default)" },
                { value: "queued", label: "Antrean" },
                { value: "in_progress", label: "Dikerjakan" },
                { value: "done", label: "Selesai" },
                { value: "cancelled", label: "Dibatalkan" },
                { value: "all", label: "Semua" },
              ],
            },
            { type: "select", key: "vehicle", label: "Kendaraan", options: vehicleOpts },
          ]}
        />
        {!data?.length ? (
          <EmptyState icon={Wrench} title="Tidak ada perbaikan" description={status === "open" ? "Semua kendaraan dalam kondisi baik." : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Komponen</TableHead>
                <SortHead k="created" defaultDirection="desc">Dilaporkan</SortHead>
                <TableHead>Bengkel</TableHead>
                <SortHead k="cost" defaultDirection="desc" className="text-right">Biaya</SortHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.code}
                    {r.inspection_code && <div className="text-muted-foreground">dari {r.inspection_code}</div>}
                  </TableCell>
                  <TableCell>
                    <Link href={`/fleet/vehicles/${r.vehicle_id}`} className="font-mono text-sm text-primary hover:underline">{r.vehicle_plate}</Link>
                  </TableCell>
                  <TableCell>
                    {r.component}
                    {r.is_critical && <ToneBadge tone="red" className="ml-1.5 text-[10px]">kritis</ToneBadge>}
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(r.created_at)}
                    <div className="text-xs text-muted-foreground">{r.reported_by_name ?? "-"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{[r.mechanic, r.workshop].filter(Boolean).join(" · ") || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.actual_cost ? formatCurrency(r.actual_cost) : r.estimated_cost ? <span className="text-muted-foreground">± {formatCurrency(r.estimated_cost)}</span> : "-"}
                  </TableCell>
                  <TableCell><StatusBadge map={FLEET_REPAIR_STATUS} value={r.status} /></TableCell>
                  <TableCell>
                    <RepairRowActions id={r.id} code={r.code} status={r.status} parts={(parts ?? []).map((p) => ({ value: p.id, label: p.name }))} />
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
