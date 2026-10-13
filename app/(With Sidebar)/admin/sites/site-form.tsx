"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import type { Site } from "@/lib/types";
import { saveSite } from "./actions";

export function SiteFormDialog({
  site,
  companies,
  trigger,
}: {
  site?: Site;
  companies: Option[];
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [company, setCompany] = useState<string>(site?.company ?? companies[0]?.value ?? "");

  return (
    <FormDialog
      trigger={trigger}
      title={site ? "Edit site" : "Tambah site"}
      onSubmit={(fd) => run(() => saveSite(fd))}
    >
      {site && <input type="hidden" name="id" value={site.id} />}
      <input type="hidden" name="company" value={company} />
      <Field label="Nama site" htmlFor="site-name" required>
        <Input id="site-name" name="name" defaultValue={site?.name} required maxLength={100} />
      </Field>
      <Field label="Perusahaan" required hint="LOURDES = site yang dipakai GMI dan GIS.">
        <OptionSelect value={company} onValueChange={setCompany} options={companies} />
      </Field>
      <Field label="Alamat" htmlFor="site-address">
        <Input id="site-address" name="address" defaultValue={site?.address ?? ""} maxLength={300} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_active" defaultChecked={site?.is_active ?? true} />
        Aktif
      </label>
    </FormDialog>
  );
}
