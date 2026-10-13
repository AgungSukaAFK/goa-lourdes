import type { Metadata } from "next";
import { Plus, UserCog } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { requireModerator } from "@/lib/auth/session";
import { getCompanyFilter } from "@/lib/company";
import { companyOptions } from "@/lib/company-options";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { ACCOUNT_STATUS, COMPANY_TONE } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isSyntheticEmail } from "@/lib/auth/identity";
import { MODULE_ROLE_LABELS, type AppModule, type ModuleAccess, type Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { UserFormDialog, type UserRow } from "./user-form";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "User Management" };

const SORTS = { name: { column: "name" }, nrp: { column: "nrp" }, created: { column: "created_at" } };
const MODULE_NAMES: Record<AppModule, string> = { asset: "Asset", fleet: "Fleet", goa: "GOA" };

type DbRow = Profile & { module_access: { module: AppModule; role: string; permissions: Record<string, never> }[] };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await requireModerator();
  const filter = await getCompanyFilter(session);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const status = param(sp, "status");
  const moduleFilter = param(sp, "module");

  const supabase = await createClient();
  const accessJoin = moduleFilter ? "module_access!inner(module, role, permissions)" : "module_access(module, role, permissions)";
  let query = supabase.from("profiles").select(`*, ${accessJoin}`, { count: "exact" });
  // Akun baru daftar (PT kosong) tetap tampil walau sedang filter PT.
  if (filter) query = query.or(`company.in.(${filter},LOURDES),company.is.null`);
  if (q) query = query.or(`name.ilike.${ilikeTerm(q)},nrp.ilike.${ilikeTerm(q)},email.ilike.${ilikeTerm(q)}`);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false).not("company", "is", null);
  if (status === "incomplete") query = query.is("company", null);
  if (status === "moderator") query = query.eq("is_moderator", true);
  if (moduleFilter) query = query.eq("module_access.module", moduleFilter);

  const [{ data, count }, { count: pendingCount }, { data: emps }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("employees").select("id, nrp, name, company").eq("is_active", true).order("name").limit(5000),
  ]);

  const users: UserRow[] = ((data ?? []) as DbRow[]).map(({ module_access, ...p }) => {
    const access: ModuleAccess = {};
    for (const a of module_access) (access as Record<string, unknown>)[a.module] = { role: a.role, permissions: a.permissions ?? {} };
    return { ...p, access };
  });
  const companies = companyOptions(session.profile, true);
  const employees = (emps ?? []).map((e) => ({ value: e.id, label: `${e.name}`, description: `${e.nrp} · ${e.company}` }));

  return (
    <Content
      title="User Management"
      description={
        pendingCount
          ? `${pendingCount} akun menunggu aktivasi. Lengkapi PT & akses, lalu aktifkan.`
          : "Kelola akun login, status aktif, dan akses per modul."
      }
      cardAction={
        <UserFormDialog
          companies={companies}
          employees={employees}
          trigger={
            <Button>
              <Plus />
              Tambah Akun
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari nama, NRP, email..."
          fields={[
            {
              type: "select",
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
                { value: "incomplete", label: "Perlu dilengkapi" },
                { value: "moderator", label: "Moderator" },
              ],
            },
            {
              type: "select",
              key: "module",
              label: "Punya akses",
              options: [
                { value: "asset", label: "Asset" },
                { value: "fleet", label: "Fleet" },
                { value: "goa", label: "GOA" },
              ],
            },
          ]}
        />
        {users.length === 0 ? (
          <EmptyState icon={UserCog} title="Tidak ada akun" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="name">Nama</SortHead>
                <SortHead k="nrp">Login</SortHead>
                <TableHead>PT</TableHead>
                <TableHead>Akses modul</TableHead>
                <TableHead>Status</TableHead>
                <SortHead k="created" defaultDirection="desc">Dibuat</SortHead>
                <TableHead className="w-40 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.is_moderator && (
                      <Badge variant="secondary" className="ml-2 text-[11px]">
                        Moderator
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono">{u.nrp ?? "-"}</div>
                    {!isSyntheticEmail(u.email) && <div className="text-muted-foreground">{u.email}</div>}
                  </TableCell>
                  <TableCell>
                    {u.company ? <ToneBadge tone={COMPANY_TONE[u.company]}>{u.company}</ToneBadge> : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.is_moderator ? (
                        <span className="text-xs text-muted-foreground">Semua modul</span>
                      ) : (
                        (Object.keys(MODULE_NAMES) as AppModule[])
                          .filter((m) => u.access[m])
                          .map((m) => (
                            <Badge key={m} variant="outline" className="text-[11px]">
                              {MODULE_NAMES[m]} · {(MODULE_ROLE_LABELS[m] as Record<string, string>)[u.access[m]!.role]}
                            </Badge>
                          ))
                      )}
                      {!u.is_moderator && !Object.keys(u.access).length && <span className="text-xs text-muted-foreground">Belum ada</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={ACCOUNT_STATUS} value={!u.company ? "incomplete" : u.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <UserRowActions user={u} isSelf={u.id === session.userId} companies={companies} employees={employees} />
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
