import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Plus } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { requireAssetMenu } from "@/lib/asset/guard";
import { loadAssetOptions, loadAssetPicks } from "@/lib/asset/options";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { ASSET_REQUEST_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { MutationRequestDialog } from "../_components/asset-dialogs";
import { MutationRowActions } from "./mutation-row-actions";

export const metadata: Metadata = { title: "Mutasi Aset" };

const SORTS = { code: { column: "code" }, created: { column: "created_at" } };

type Mut = {
  id: string;
  code: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  from_name: string | null;
  to_name: string | null;
  from_site_name: string | null;
  to_site_name: string | null;
  reason: string | null;
  status: string;
  is_direct: boolean;
  created_at: string;
  decision_note: string | null;
};

export default async function MutationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireAssetMenu("mutations");
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const status = param(sp, "status");

  const supabase = await createClient();
  let query = supabase.from("asset_mutations_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},asset_code.ilike.${t},asset_name.ilike.${t},from_name.ilike.${t},to_name.ilike.${t}`);
  }
  if (status) query = query.eq("status", status);

  const canWrite = s.can("write");
  const [{ data, count }, options, picks] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    canWrite ? loadAssetOptions(s) : Promise.resolve(null),
    canWrite ? loadAssetPicks() : Promise.resolve([]),
  ]);
  const rows = (data ?? []) as Mut[];

  return (
    <Content
      title="Mutasi"
      description="Perpindahan pemegang / lokasi aset dengan persetujuan GA."
      cardAction={
        canWrite && options ? (
          <MutationRequestDialog
            assets={picks}
            employees={options.employees}
            sites={options.sites}
            isAdmin={s.isAdmin}
            trigger={
              <Button>
                <Plus />
                Ajukan Mutasi
              </Button>
            }
          />
        ) : undefined
      }
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no. mutasi, aset, karyawan..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "pending", label: "Menunggu GA" },
                { value: "approved", label: "Disetujui" },
                { value: "rejected", label: "Ditolak" },
              ],
            },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Belum ada mutasi" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="code">No.</SortHead>
                <TableHead>Aset</TableHead>
                <TableHead>Dari → Ke</TableHead>
                <TableHead>Alasan</TableHead>
                <SortHead k="created" defaultDirection="desc">Tanggal</SortHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">
                    {m.code}
                    {m.is_direct && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        Langsung
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/asset/assets/${m.asset_id}`} className="font-medium hover:underline">
                      {m.asset_name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{m.asset_code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">{m.from_name ?? "-"}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{m.to_name ?? "-"}</span>
                    </div>
                    {m.from_site_name !== m.to_site_name && (
                      <div className="text-xs text-muted-foreground">
                        {m.from_site_name ?? "-"} → {m.to_site_name ?? "-"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground" title={m.reason ?? ""}>
                    {m.reason || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(m.created_at)}</TableCell>
                  <TableCell>
                    <StatusBadge map={ASSET_REQUEST_STATUS} value={m.status} />
                  </TableCell>
                  <TableCell>
                    <MutationRowActions id={m.id} code={m.code} status={m.status} isAdmin={s.isAdmin} canDelete={s.can("delete")} />
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
