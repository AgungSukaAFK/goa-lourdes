import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Content } from "@/components/content";
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
import { ASSET_AUDIT_STATUS, ASSET_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AuditRowActions, CreateAuditDialog } from "./audit-dialogs";

export const metadata: Metadata = { title: "Audit Aset" };

const SORTS = { code: { column: "code" }, due: { column: "due_date" }, created: { column: "created_at" } };

type Audit = {
  id: string;
  code: string;
  company: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  site_name: string | null;
  owner_name: string | null;
  due_date: string;
  status: string;
  is_overdue: boolean;
  found_condition: string | null;
  notes: string | null;
  realized_by_name: string | null;
  realized_at: string | null;
};

export default async function AuditsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireAssetMenu("audits");
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "due.asc");
  const q = param(sp, "q");
  const status = param(sp, "status") || "";

  const supabase = await createClient();
  let query = supabase.from("asset_audits_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},asset_code.ilike.${t},asset_name.ilike.${t},site_name.ilike.${t}`);
  }
  if (status === "overdue") query = query.eq("is_overdue", true);
  else if (status) query = query.eq("status", status);

  const canWrite = s.can("write");
  const [{ data, count }, options, picks] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    canWrite ? loadAssetOptions(s) : Promise.resolve(null),
    canWrite ? loadAssetPicks() : Promise.resolve([]),
  ]);
  const rows = (data ?? []) as Audit[];

  return (
    <Content
      title="Audit Aset"
      description="Pemeriksaan fisik berkala: buat tugas, periksa, catat temuan."
      cardAction={canWrite && options ? <CreateAuditDialog assets={picks} sites={options.sites} /> : undefined}
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no. audit, aset, site..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "waiting", label: "Menunggu cek" },
                { value: "overdue", label: "Lewat jatuh tempo" },
                { value: "fulfilled", label: "Selesai" },
              ],
            },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Belum ada audit" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="code">No.</SortHead>
                <TableHead>Aset</TableHead>
                <TableHead>Site / PIC</TableHead>
                <SortHead k="due">Jatuh tempo</SortHead>
                <TableHead>Status</TableHead>
                <TableHead>Temuan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>
                    <Link href={`/asset/assets/${a.asset_id}`} className="font-medium hover:underline">
                      {a.asset_name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{a.asset_code}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.site_name ?? "-"}
                    <div className="text-xs text-muted-foreground">{a.owner_name ?? "-"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(a.due_date)}</TableCell>
                  <TableCell>
                    <StatusBadge map={ASSET_AUDIT_STATUS} value={a.is_overdue ? "overdue" : a.status} />
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    {a.found_condition ? (
                      <>
                        <StatusBadge map={ASSET_STATUS} value={a.found_condition} />
                        <div className="mt-1 truncate text-xs text-muted-foreground" title={a.notes ?? ""}>
                          {a.realized_by_name} · {formatDate(a.realized_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AuditRowActions
                      id={a.id}
                      code={a.code}
                      company={a.company}
                      assetId={a.asset_id}
                      status={a.status}
                      canWrite={canWrite}
                      canDelete={s.can("delete")}
                    />
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
