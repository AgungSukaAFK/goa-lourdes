import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { requireAssetMenu } from "@/lib/asset/guard";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/asset/types";
import { formatNumber } from "@/lib/utils";
import { CategoryFormDialog, CategoryRowActions } from "./category-client";

export const metadata: Metadata = { title: "Kategori Aset" };

export default async function CategoriesPage() {
  const s = await requireAssetMenu("config");
  const supabase = await createClient();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("asset_categories").select("id, name, code, depreciation_years").order("name"),
    supabase.from("assets").select("category_id"),
  ]);
  const cats = (data ?? []) as Category[];
  const countMap = new Map<string, number>();
  for (const r of counts ?? []) if (r.category_id) countMap.set(r.category_id, (countMap.get(r.category_id) ?? 0) + 1);

  return (
    <Content
      title="Kategori Aset"
      description="Kategori menentukan masa penyusutan default dan kode {CAT}."
      cardAction={s.can("write") ? <CategoryFormDialog /> : undefined}
    >
      {cats.length === 0 ? (
        <EmptyState icon={Tags} title="Belum ada kategori" description="Contoh: IT Hardware, Furniture, Kendaraan, Elektronik." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead className="text-right">Penyusutan</TableHead>
              <TableHead className="text-right">Jumlah aset</TableHead>
              {s.can("write") && <TableHead className="w-24 text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cats.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.code || c.name.slice(0, 3).toUpperCase()}</TableCell>
                <TableCell className="text-right">{c.depreciation_years} tahun</TableCell>
                <TableCell className="text-right">{formatNumber(countMap.get(c.id) ?? 0)}</TableCell>
                {s.can("write") && (
                  <TableCell>
                    <CategoryRowActions category={c} canDelete={s.can("delete")} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Content>
  );
}
