"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { MultiOptionSelect } from "@/components/multi-option-select";
import { useAction } from "@/hooks/use-action";
import { deleteDriver, saveDriver } from "./actions";

export type DriverRow = {
  id: string;
  employee_id: string;
  name: string;
  nrp: string;
  company: string;
  license_no: string | null;
  license_type: string | null;
  license_expiry: string | null;
  is_active: boolean;
  profile_id: string | null;
  vehicle_ids: string[];
};

export function DriverFormDialog({
  driver,
  employees,
  vehicles,
}: {
  driver?: DriverRow;
  employees: Option[];
  vehicles: Option[];
}) {
  const { run } = useAction();
  const [emp, setEmp] = useState(driver?.employee_id ?? "");
  const [veh, setVeh] = useState<string[]>(driver?.vehicle_ids ?? []);

  return (
    <FormDialog
      trigger={
        driver ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${driver.name}`} title="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Tambah Driver
          </Button>
        )
      }
      title={driver ? `Edit driver ${driver.name}` : "Tambah driver"}
      description="Driver diambil dari master karyawan. Supaya bisa login & isi P2H, buatkan akun dengan role Fleet: Driver."
      onSubmit={(fd) => run(() => saveDriver(fd))}
    >
      {driver && <input type="hidden" name="id" value={driver.id} />}
      <input type="hidden" name="employee_id" value={emp} />
      <input type="hidden" name="vehicle_ids" value={veh.join(",")} />
      <Field label="Karyawan" required>
        <OptionSelect
          value={emp}
          onValueChange={setEmp}
          options={driver ? [{ value: driver.employee_id, label: driver.name, description: driver.nrp }] : employees}
          placeholder="Pilih karyawan"
          disabled={!!driver}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="No. SIM" htmlFor="d-lic">
          <Input id="d-lic" name="license_no" defaultValue={driver?.license_no ?? ""} />
        </Field>
        <Field label="Jenis SIM" htmlFor="d-type">
          <Input id="d-type" name="license_type" defaultValue={driver?.license_type ?? ""} placeholder="A / B1 / B2" />
        </Field>
        <Field label="Berlaku s/d" htmlFor="d-exp">
          <Input id="d-exp" name="license_expiry" type="date" defaultValue={driver?.license_expiry ?? ""} />
        </Field>
      </div>
      <Field label="Kendaraan tetap" hint="Dipakai sebagai pilihan default saat isi P2H.">
        <MultiOptionSelect value={veh} onChange={setVeh} options={vehicles} placeholder="Tambah kendaraan..." />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_active" defaultChecked={driver?.is_active ?? true} />
        Aktif
      </label>
    </FormDialog>
  );
}

export function DriverDelete({ driver }: { driver: DriverRow }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      destructive
      title={`Hapus driver ${driver.name}?`}
      description="Data karyawan tetap ada. Riwayat P2H & booking kehilangan nama driver."
      confirmText="Hapus"
      onConfirm={() => run(() => deleteDriver(driver.id))}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Hapus ${driver.name}`} title="Hapus">
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  );
}
