import type { Metadata } from "next";
import Link from "next/link";
import { Handshake, Plus } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
import { LoanRequestDialog } from "../_components/asset-dialogs";
import { LoanRowActions } from "./loan-row-actions";

export const metadata: Metadata = { title: "Peminjaman Aset" };

const SORTS = { code: { column: "code" }, borrow: { column: "borrow_date" }, due: { column: "expected_return_date" }, created: { column: "created_at" } };

type Loan = {
  id: string;
  code: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  borrower_name: string;
  borrower_nrp: string;
  borrow_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  purpose: string | null;
  status: string;
  is_overdue: boolean;
  decision_note: string | null;
};

export default async function LoansPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireAssetMenu("loans");
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const status = param(sp, "status");

  const supabase = await createClient();
  let query = supabase.from("asset_loans_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},asset_code.ilike.${t},asset_name.ilike.${t},borrower_name.ilike.${t},borrower_nrp.ilike.${t}`);
  }
  if (status === "overdue") query = query.eq("is_overdue", true);
  else if (status) query = query.eq("status", status);

  const canWrite = s.can("write");
  const [{ data, count }, options, picks] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    canWrite ? loadAssetOptions(s) : Promise.resolve(null),
    canWrite ? loadAssetPicks() : Promise.resolve([]),
  ]);
  const rows = (data ?? []) as Loan[];

  return (
    <Content
      title="Peminjaman"
      description="Pengajuan → persetujuan GA → aset dipinjam → dikembalikan."
      cardAction={
        canWrite && options ? (
          <LoanRequestDialog
            assets={picks}
            employees={options.employees}
            isAdmin={s.isAdmin}
            trigger={
              <Button>
                <Plus />
                Ajukan Pinjam
              </Button>
            }
          />
        ) : undefined
      }
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no. pinjam, aset, peminjam..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "pending", label: "Menunggu GA" },
                { value: "approved", label: "Sedang dipinjam" },
                { value: "overdue", label: "Terlambat" },
                { value: "returned", label: "Dikembalikan" },
                { value: "rejected", label: "Ditolak" },
              ],
            },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Handshake} title="Belum ada peminjaman" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="code">No.</SortHead>
                <TableHead>Aset</TableHead>
                <TableHead>Peminjam</TableHead>
                <SortHead k="borrow" defaultDirection="desc">Pinjam</SortHead>
                <SortHead k="due">Kembali</SortHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.code}</TableCell>
                  <TableCell>
                    <Link href={`/asset/assets/${l.asset_id}`} className="font-medium hover:underline">
                      {l.asset_name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{l.asset_code}</div>
                  </TableCell>
                  <TableCell>
                    {l.borrower_name}
                    <div className="text-xs text-muted-foreground">{l.borrower_nrp}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(l.borrow_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(l.expected_return_date)}
                    {l.actual_return_date && (
                      <div className="text-xs text-muted-foreground">Kembali {formatDate(l.actual_return_date)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={ASSET_REQUEST_STATUS} value={l.is_overdue ? "overdue" : l.status} />
                    {l.decision_note && <div className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground" title={l.decision_note}>{l.decision_note}</div>}
                  </TableCell>
                  <TableCell>
                    <LoanRowActions id={l.id} code={l.code} status={l.status} isAdmin={s.isAdmin} canDelete={s.can("delete")} />
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
