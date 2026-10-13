"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { FLEET_VEHICLE_STATUS } from "@/lib/status";
import type { Vehicle } from "@/lib/fleet/types";
import { saveVehicle } from "./actions";

export function VehicleFormDialog({
  vehicle,
  companies,
  sites,
  trigger,
}: {
  vehicle?: Vehicle;
  companies: Option[];
  sites: (Option & { company: string })[];
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [company, setCompany] = useState<string>(vehicle?.company ?? companies[0]?.value ?? "GMI");
  const [site, setSite] = useState(vehicle?.site_id ?? "");
  const [status, setStatus] = useState<string>(vehicle?.status ?? "available");
  const statusOptions = Object.entries(FLEET_VEHICLE_STATUS)
    .filter(([k]) => k !== "in_use" || vehicle?.status === "in_use")
    .map(([value, d]) => ({ value, label: d.label }));

  return (
    <FormDialog
      trigger={trigger}
      title={vehicle ? `Edit ${vehicle.plate}` : "Tambah kendaraan"}
      onSubmit={(fd) => run(() => saveVehicle(fd))}
      className="sm:max-w-2xl"
    >
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="site_id" value={site} />
      <input type="hidden" name="status" value={status} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomor polisi" htmlFor="v-plate" required>
          <Input id="v-plate" name="plate" defaultValue={vehicle?.plate} required className="uppercase" placeholder="B 1234 XYZ" />
        </Field>
        <Field label="Model" htmlFor="v-model" required>
          <Input id="v-model" name="model" defaultValue={vehicle?.model} required placeholder="Toyota Avanza" />
        </Field>
        <Field label="Merek" htmlFor="v-brand">
          <Input id="v-brand" name="brand" defaultValue={vehicle?.brand ?? ""} />
        </Field>
        <Field label="Tahun" htmlFor="v-year">
          <Input id="v-year" name="year" type="number" min={1980} max={2100} defaultValue={vehicle?.year ?? ""} />
        </Field>
        <Field label="PT" required>
          <OptionSelect value={company} onValueChange={(v) => { setCompany(v); setSite(""); }} options={companies} />
        </Field>
        <Field label="Site / pool">
          <OptionSelect
            value={site}
            onValueChange={setSite}
            options={sites.filter((s) => s.company === company || s.company === "LOURDES")}
            placeholder="Pilih site"
          />
        </Field>
        <Field label="KM saat ini" htmlFor="v-odo" required>
          <Input id="v-odo" name="odometer" type="number" min={0} defaultValue={vehicle?.odometer ?? 0} required />
        </Field>
        <Field label="Status" required>
          <OptionSelect value={status} onValueChange={setStatus} options={statusOptions} />
        </Field>
        <Field label="Interval servis berkala (km)" htmlFor="v-int" required>
          <Input id="v-int" name="service_interval_km" type="number" min={500} defaultValue={vehicle?.service_interval_km ?? 5000} required />
        </Field>
        <Field label="KM servis terakhir" htmlFor="v-last" required>
          <Input id="v-last" name="last_service_odo" type="number" min={0} defaultValue={vehicle?.last_service_odo ?? 0} required />
        </Field>
        <Field label="Jatuh tempo pajak / STNK" htmlFor="v-tax">
          <Input id="v-tax" name="tax_date" type="date" defaultValue={vehicle?.tax_date ?? ""} />
        </Field>
        <Field label="Jatuh tempo KIR" htmlFor="v-kir">
          <Input id="v-kir" name="kir_date" type="date" defaultValue={vehicle?.kir_date ?? ""} />
        </Field>
        <Field label="Ganti plat (5 tahun)" htmlFor="v-plate-date">
          <Input id="v-plate-date" name="plate_date" type="date" defaultValue={vehicle?.plate_date ?? ""} />
        </Field>
      </div>
      <Field label="Catatan" htmlFor="v-notes">
        <Textarea id="v-notes" name="notes" rows={2} defaultValue={vehicle?.notes ?? ""} />
      </Field>
    </FormDialog>
  );
}
