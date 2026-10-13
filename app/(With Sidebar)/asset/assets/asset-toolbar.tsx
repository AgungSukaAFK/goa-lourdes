"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImportButton } from "@/components/import-button";
import { exportExcel } from "@/lib/excel";
import { ASSET_IMPORT_HEADERS } from "@/lib/asset/code";
import { ASSET_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { AssetRow } from "@/lib/asset/types";
import { exportAssets, importAssets } from "./actions";
import { AssetFormDialog, type AssetFormOptions } from "./asset-form";

export function AssetToolbar({ options, canWrite }: { options: AssetFormOptions; canWrite: boolean }) {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    const res = await exportAssets(Object.fromEntries(sp.entries()));
    setBusy(false);
    if (!res.ok || !res.data?.length) return toast.error(res.ok ? "Tidak ada data untuk diekspor." : res.error);
    await exportExcel<AssetRow>(`aset-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Aset",
        rows: res.data as unknown as AssetRow[],
        columns: [
          { header: "Kode Aset", key: "code", width: 34 },
          { header: "Nama Aset", key: "name", width: 30 },
          { header: "PT", key: "company", width: 8 },
          { header: "Kategori", key: "category_name" },
          { header: "Merek", key: "brand" },
          { header: "Model", key: "model" },
          { header: "Serial Number", key: "serial_number" },
          { header: "Site", key: "site_name" },
          { header: "NRP Pemegang", key: "owner_nrp" },
          { header: "Nama Pemegang", key: "owner_name", width: 24 },
          { header: "Status", key: "status", value: (r) => ASSET_STATUS[r.status]?.label ?? r.status },
          { header: "Tanggal Pembelian", key: "purchase_date", value: (r) => (r.purchase_date ? formatDate(r.purchase_date) : "") },
          { header: "Harga Perolehan", key: "cost" },
          { header: "Masa Penyusutan (Tahun)", key: "depreciation_years" },
          { header: "Nilai Buku", key: "book_value" },
          { header: "Dapat Dipinjam", key: "is_borrowable", value: (r) => (r.is_borrowable ? "YA" : "TIDAK") },
          { header: "Kode Accurate", key: "accurate_code" },
          { header: "Nomor MR", key: "mr_number" },
          { header: "Nomor PO", key: "po_number" },
        ],
      },
    ]);
  };

  return (
    <>
      <Button variant="outline" onClick={doExport} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        Export
      </Button>
      {canWrite && (
        <>
          <ImportButton
            title="Import aset"
            description="Kode Aset kosong = dibuat otomatis. Kode yang sudah ada akan diperbarui. Kategori/site baru dibuat otomatis."
            templateName="template-aset.xlsx"
            headers={[...ASSET_IMPORT_HEADERS]}
            example={["", "Laptop Lenovo T14", "GMI", "IT Hardware", "Lenovo", "T14 Gen 3", "PF3XXXX", "Head Office", "20260101", "2025-08-01", 15000000, 4, "TIDAK", "", "MR-001", "PO-001"]}
            onImport={importAssets}
          />
          <AssetFormDialog
            options={options}
            trigger={
              <Button>
                <Plus />
                Registrasi Aset
              </Button>
            }
          />
        </>
      )}
    </>
  );
}
