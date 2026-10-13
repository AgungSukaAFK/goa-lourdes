"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import type { Employee } from "@/lib/types";
import { saveEmployee } from "./actions";

export type SiteOption = Option & { company: string };

export function EmployeeFormDialog({
  employee,
  companies,
  sites,
  trigger,
}: {
  employee?: Employee;
  companies: Option[];
  sites: SiteOption[];
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [company, setCompany] = useState<string>(employee?.company ?? companies[0]?.value ?? "");
  const [siteId, setSiteId] = useState<string>(employee?.site_id ?? "");
  const siteOptions = sites.filter((s) => s.company === company || s.company === "LOURDES" || company === "LOURDES");

  return (
    <FormDialog
      trigger={trigger}
      title={employee ? "Edit karyawan" : "Tambah karyawan"}
      onSubmit={(fd) => run(() => saveEmployee(fd))}
      className="sm:max-w-2xl"
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="site_id" value={siteId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="NRP" htmlFor="emp-nrp" required>
          <Input id="emp-nrp" name="nrp" defaultValue={employee?.nrp} required maxLength={30} />
        </Field>
        <Field label="Nama lengkap" htmlFor="emp-name" required>
          <Input id="emp-name" name="name" defaultValue={employee?.name} required maxLength={120} />
        </Field>
        <Field label="Perusahaan" required>
          <OptionSelect value={company} onValueChange={(v) => { setCompany(v); setSiteId(""); }} options={companies} />
        </Field>
        <Field label="Site">
          <OptionSelect value={siteId} onValueChange={setSiteId} options={siteOptions} placeholder="Pilih site" />
        </Field>
        <Field label="Jabatan" htmlFor="emp-position">
          <Input id="emp-position" name="position" defaultValue={employee?.position ?? ""} maxLength={100} />
        </Field>
        <Field label="Divisi" htmlFor="emp-division">
          <Input id="emp-division" name="division" defaultValue={employee?.division ?? ""} maxLength={100} />
        </Field>
        <Field label="Tanggal masuk" htmlFor="emp-join">
          <Input id="emp-join" name="join_date" type="date" defaultValue={employee?.join_date ?? ""} />
        </Field>
        <Field label="No HP" htmlFor="emp-phone">
          <Input id="emp-phone" name="phone" type="tel" defaultValue={employee?.phone ?? ""} maxLength={30} />
        </Field>
        <Field label="Email" htmlFor="emp-email" className="sm:col-span-2" hint="Opsional. Dipakai sebagai email login kalau dibuatkan akun.">
          <Input id="emp-email" name="email" type="email" defaultValue={employee?.email ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_active" defaultChecked={employee?.is_active ?? true} />
        Masih aktif bekerja
      </label>
    </FormDialog>
  );
}
