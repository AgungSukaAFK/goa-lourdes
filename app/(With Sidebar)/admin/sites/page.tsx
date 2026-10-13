import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getCompanyFilter } from "@/lib/company";
import { companyOptions } from "@/lib/company-options";
import { isAnyAdmin } from "@/lib/modules";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { ACCOUNT_STATUS, COMPANY_TONE } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Site } from "@/lib/types";
import { SiteFormDialog } from "./site-form";
import { SiteRowActions } from "./site-row-actions";

export const metadata: Metadata = { title: "Site" };

const SORTS = { name: { column: "name" }, company: { column: "company" } };

export default async function SitesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await requireSession();
  if (!isAnyAdmin({ isModerator: session.profile.is_moderator, access: session.access })) notFound();

  const filter = await getCompanyFilter(session);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "name.asc");
  const q = param(sp, "q");
  const status = param(sp, "status");

  const supabase = await createClient();
  let query = supabase.from("sites").select("*", { count: "exact" });
  if (filter) query = query.in("company", [filter, "LOURDES"]);
  if (q) query = query.or(`name.ilike.${ilikeTerm(q)},address.ilike.${ilikeTerm(q)}`);
  if (status) query = query.eq("is_active", status === "active");
  const { data, count } = await query.order(sort.column, { ascending: sort.ascending }).range(from, to);
  const sites = (data ?? []) as Site[];
  const companies = companyOptions(session.profile, true);

  return (
    <Content
      title="Site"
      description="Lokasi kerja yang dipakai karyawan, aset, dan kendaraan."
      cardAction={
        <SiteFormDialog
          companies={companies}
          trigger={
            <Button>
              <Plus />
              Tambah Site
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari nama atau alamat site..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ],
            },
          ]}
        />
        {sites.length === 0 ? (
          <EmptyState icon={Building2} title="Belum ada site" description={q ? "Tidak ada site yang cocok dengan pencarian." : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="name">Nama</SortHead>
                <SortHead k="company">PT</SortHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <ToneBadge tone={COMPANY_TONE[s.company]}>{s.company}</ToneBadge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{s.address || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge map={ACCOUNT_STATUS} value={s.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    <SiteRowActions site={s} companies={companies} />
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
