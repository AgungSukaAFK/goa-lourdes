"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImportButton } from "@/components/import-button";
import type { Option } from "@/components/option-select";
import { exportExcel } from "@/lib/excel";
import { formatDate } from "@/lib/utils";
import { exportEmployees, importEmployees } from "./actions";
import { EmployeeFormDialog, type SiteOption } from "./employee-form";

export function EmployeeToolbar({ companies, sites }: { companies: Option[]; sites: SiteOption[] }) {
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    const res = await exportEmployees();
    setExporting(false);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Tidak ada data." : res.error);
    type Row = Record<string, unknown> & { site?: { name: string } | null };
    await exportExcel<Row>(`karyawan-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "Karyawan",
        rows: res.data as Row[],
        columns: [
          { header: "NRP", key: "nrp", width: 14 },
          { header: "Nama", key: "name", width: 28 },
          { header: "PT", key: "company", width: 10 },
          { header: "Jabatan", key: "position" },
          { header: "Divisi", key: "division" },
          { header: "Site", key: "site", value: (r) => r.site?.name ?? "" },
          { header: "Tanggal Masuk", key: "join_date", value: (r) => (r.join_date ? formatDate(r.join_date as string) : "") },
          { header: "No HP", key: "phone" },
          { header: "Email", key: "email", width: 26 },
          { header: "Status", key: "is_active", value: (r) => (r.is_active ? "Aktif" : "Nonaktif") },
        ],
      },
    ]);
  };

  return (
    <>
      <Button variant="outline" onClick={doExport} disabled={exporting}>
        {exporting ? <Loader2 className="animate-spin" /> : <Download />}
        Export
      </Button>
      <ImportButton
        title="Import karyawan"
        description="Baris dengan NRP yang sudah ada akan diperbarui. Site yang belum ada otomatis dibuat."
        templateName="template-karyawan.xlsx"
        headers={["NRP", "Nama", "PT", "Jabatan", "Divisi", "Site", "Tanggal Masuk", "No HP", "Email"]}
        example={["20260101", "Budi Santoso", "GMI", "Staff GA", "General Affair", "Head Office", "2024-01-15", "081234567890", ""]}
        onImport={importEmployees}
      />
      <EmployeeFormDialog
        companies={companies}
        sites={sites}
        trigger={
          <Button>
            <Plus />
            Tambah Karyawan
          </Button>
        }
      />
    </>
  );
}
