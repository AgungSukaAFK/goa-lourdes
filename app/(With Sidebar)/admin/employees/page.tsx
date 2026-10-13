import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdCard } from "lucide-react";
import { Content } from "@/components/content";
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
import type { Employee } from "@/lib/types";
import { EmployeeRowActions } from "./employee-row-actions";
import { EmployeeToolbar } from "./employee-toolbar";

export const metadata: Metadata = { title: "Karyawan" };

const SORTS = {
  nrp: { column: "nrp" },
  name: { column: "name" },
  company: { column: "company" },
  position: { column: "position" },
};

type Row = Employee & { site: { name: string } | null; profile: { id: string } | { id: string }[] | null };

// profiles.employee_id unik -> PostgREST bisa mengembalikan objek atau array.
const hasAccount = (p: Row["profile"]) => (Array.isArray(p) ? p.length > 0 : !!p);

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await requireSession();
  if (!isAnyAdmin({ isModerator: session.profile.is_moderator, access: session.access })) notFound();

  const filter = await getCompanyFilter(session);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "name.asc");
  const q = param(sp, "q");
  const status = param(sp, "status");
  const site = param(sp, "site");
  const account = param(sp, "account");

  const supabase = await createClient();
  const profileJoin = account === "yes" ? "profiles!profiles_employee_id_fkey!inner(id)" : "profiles!profiles_employee_id_fkey(id)";
  let query = supabase.from("employees").select(`*, site:sites(name), profile:${profileJoin}`, { count: "exact" });
  if (account === "no") query = query.is("profile", null);
  if (filter) query = query.in("company", [filter, "LOURDES"]);
  if (q) query = query.or(`name.ilike.${ilikeTerm(q)},nrp.ilike.${ilikeTerm(q)},position.ilike.${ilikeTerm(q)}`);
  if (status) query = query.eq("is_active", status === "active");
  if (site) query = query.eq("site_id", site);

  const [{ data, count }, { data: siteRows }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    supabase.from("sites").select("id, name, company").eq("is_active", true).order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  const companies = companyOptions(session.profile, true);
  const sites = (siteRows ?? []).map((s) => ({ value: s.id, label: s.name, description: s.company, company: s.company }));
  const isMod = session.profile.is_moderator;

  return (
    <Content title="Karyawan" description="Master karyawan untuk semua modul. Karyawan tidak wajib punya akun login.">
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari NRP, nama, jabatan..."
          actions={<EmployeeToolbar companies={companies} sites={sites} />}
          fields={[
            { type: "select", key: "site", label: "Site", options: sites },
            { type: "select", key: "status", label: "Status", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
            { type: "select", key: "account", label: "Akun login", options: [{ value: "yes", label: "Sudah punya" }, { value: "no", label: "Belum punya" }] },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={IdCard} title="Belum ada karyawan" description="Tambah satu per satu atau import dari Excel." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="nrp">NRP</SortHead>
                <SortHead k="name">Nama</SortHead>
                <SortHead k="company">PT</SortHead>
                <SortHead k="position">Jabatan</SortHead>
                <TableHead>Site</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.nrp}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>
                    <ToneBadge tone={COMPANY_TONE[e.company]}>{e.company}</ToneBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.position || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.site?.name ?? "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{hasAccount(e.profile) ? "Ada" : "-"}</TableCell>
                  <TableCell>
                    <StatusBadge map={ACCOUNT_STATUS} value={e.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    <EmployeeRowActions
                      employee={e}
                      companies={companies}
                      sites={sites}
                      canCreateAccount={isMod && !hasAccount(e.profile)}
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
