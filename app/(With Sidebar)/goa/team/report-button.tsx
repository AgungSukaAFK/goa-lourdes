"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";

const TYPES: Option[] = [
  { value: "member", label: "Individu", description: "Rapor satu anggota, rinci per bulan" },
  { value: "category", label: "Kategori pekerjaan", description: "Semua tugas satu kategori" },
  { value: "all", label: "Semua (tim)", description: "Ringkasan KPI seluruh tim per bulan" },
];

/** Buka rapor KPI siap cetak / simpan PDF di tab baru. Anggota hanya bisa mencetak rapornya sendiri. */
export function KpiReportButton({ isSupervisor, selfId, members, categories }: { isSupervisor: boolean; selfId: string; members: Option[]; categories: string[] }) {
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7);
  const [type, setType] = useState("member");
  const [member, setMember] = useState(isSupervisor ? (members[0]?.value ?? "") : selfId);
  const [category, setCategory] = useState(categories[0] ?? "");

  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <FileText />
          Rapor KPI
        </Button>
      }
      title="Rapor KPI"
      description="Rapor dibuka di tab baru. Tekan Cetak lalu pilih Simpan sebagai PDF untuk menyimpannya."
      submitText="Buka rapor"
      onSubmit={async (fd) => {
        const q = new URLSearchParams({ type, from: String(fd.get("from")), to: String(fd.get("to")) });
        if (type === "member") q.set("member", member);
        if (type === "category") q.set("category", category);
        window.open(`/print/goa-kpi?${q}`, "_blank");
        return true;
      }}
    >
      {isSupervisor && (
        <Field label="Jenis rapor">
          <OptionSelect value={type} onValueChange={setType} options={TYPES} />
        </Field>
      )}
      {isSupervisor && type === "member" && (
        <Field label="Anggota">
          <OptionSelect value={member} onValueChange={setMember} options={members} />
        </Field>
      )}
      {type === "category" && (
        <Field label="Kategori">
          <OptionSelect value={category} onValueChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dari bulan" htmlFor="kpi-from">
          <Input id="kpi-from" name="from" type="month" defaultValue={month} required />
        </Field>
        <Field label="Sampai bulan" htmlFor="kpi-to">
          <Input id="kpi-to" name="to" type="month" defaultValue={month} required />
        </Field>
      </div>
    </FormDialog>
  );
}
