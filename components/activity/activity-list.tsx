import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters, type FilterOption } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { EmptyState } from "@/components/list/empty-state";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, pageRange, param, type SearchParams } from "@/lib/list";
import type { AppModule, CompanyCode } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const ACTION: Record<string, string> = { create: "Dibuat", update: "Diubah", delete: "Dihapus" };

/** Tabel log aktivitas satu modul (dibaca sesuai RLS: admin modul). */
export async function ActivityList({
  module,
  sp,
  entities,
  statusLabels,
  company,
}: {
  module: AppModule;
  sp: SearchParams;
  entities: FilterOption[];
  statusLabels: Record<string, string>;
  company: CompanyCode | null;
}) {
  const { page, pageSize, from, to } = pageRange(sp, 30);
  const q = param(sp, "q");
  const entity = param(sp, "entity");
  const supabase = await createClient();
  let query = supabase
    .from("activity_logs")
    .select("id, entity, action, summary, created_at, actor:profiles(name)", { count: "exact" })
    .eq("module", module);
  if (company) query = query.in("company", [company, "LOURDES"]);
  if (entity) query = query.eq("entity", entity);
  if (q) query = query.ilike("summary", ilikeTerm(q));
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const entityLabel = Object.fromEntries(entities.map((e) => [e.value, e.label]));

  return (
    <div className="space-y-4">
      <ListFilters searchPlaceholder="Cari kode / nama..." fields={[{ type: "select", key: "entity", label: "Data", options: entities }]} />
      {!data?.length ? (
        <EmptyState icon={Activity} title="Belum ada aktivitas" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(g.created_at)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px]">
                    {entityLabel[g.entity] ?? g.entity}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{g.summary ?? "-"}</TableCell>
                <TableCell className="text-sm">
                  {g.action.startsWith("status:")
                    ? `Status → ${statusLabels[g.action.slice(7)] ?? g.action.slice(7)}`
                    : (ACTION[g.action] ?? g.action)}
                </TableCell>
                <TableCell className="text-sm">{(g.actor as unknown as { name: string } | null)?.name ?? "Sistem"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}
