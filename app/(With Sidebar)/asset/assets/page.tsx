import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Content } from "@/components/content";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { EmptyState } from "@/components/list/empty-state";
import { requireAssetMenu } from "@/lib/asset/guard";
import { loadAssetOptions } from "@/lib/asset/options";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { ASSET_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { AssetRow } from "@/lib/asset/types";
import { AssetTable } from "./asset-table";
import { AssetToolbar } from "./asset-toolbar";

export const metadata: Metadata = { title: "Daftar Aset" };

const SORTS = { code: { column: "code" }, name: { column: "name" }, value: { column: "cost" }, created: { column: "created_at" } };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireAssetMenu("assets");
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp, 25);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");

  const supabase = await createClient();
  let query = supabase.from("assets_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},name.ilike.${t},brand.ilike.${t},serial_number.ilike.${t},owner_name.ilike.${t},accurate_code.ilike.${t}`);
  }
  for (const k of ["status", "category_id", "site_id"] as const) {
    const v = param(sp, k);
    if (v) query = query.eq(k, v);
  }
  const borrowable = param(sp, "borrowable");
  if (borrowable) query = query.eq("is_borrowable", borrowable === "yes");

  const [{ data, count }, options] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    loadAssetOptions(s),
  ]);
  const rows = (data ?? []) as AssetRow[];

  return (
    <Content title="Daftar Aset" description="Registrasi, label QR, dan status seluruh aset.">
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari kode, nama, merek, SN, pemegang..."
          actions={<AssetToolbar options={options} canWrite={s.can("write")} />}
          fields={[
            { type: "select", key: "status", label: "Status", options: Object.entries(ASSET_STATUS).map(([value, d]) => ({ value, label: d.label })) },
            { type: "select", key: "category_id", label: "Kategori", options: options.categories.map((c) => ({ value: c.id, label: c.name })) },
            { type: "select", key: "site_id", label: "Site", options: options.sites },
            { type: "select", key: "borrowable", label: "Dapat dipinjam", options: [{ value: "yes", label: "Ya" }, { value: "no", label: "Tidak" }] },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Package} title="Belum ada aset" description={q ? "Tidak ada aset yang cocok." : "Registrasi aset baru atau import dari Excel."} />
        ) : (
          <AssetTable rows={rows} />
        )}
        <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
      </div>
    </Content>
  );
}
