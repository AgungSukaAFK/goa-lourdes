"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { getLocalDateString } from "@/lib/utils";
import type { Vehicle } from "@/lib/fleet/types";
import { deleteVehicle, recordService } from "../actions";
import { VehicleFormDialog } from "../vehicle-form";

export function VehicleActions({
  vehicle,
  companies,
  sites,
  parts,
}: {
  vehicle: Vehicle;
  companies: Option[];
  sites: (Option & { company: string })[];
  parts: Option[];
}) {
  const { run } = useAction();
  const router = useRouter();
  const [part, setPart] = useState("");

  return (
    <div className="flex flex-wrap gap-2">
      <FormDialog
        trigger={
          <Button variant="outline">
            <Wrench />
            Catat servis
          </Button>
        }
        title={`Catat servis ${vehicle.plate}`}
        description="Dipakai sebagai titik awal prediksi servis berikutnya."
        onSubmit={(fd) => run(() => recordService(fd))}
      >
        <input type="hidden" name="vehicle_id" value={vehicle.id} />
        <input type="hidden" name="part_id" value={part} />
        <Field label="Part / jenis servis">
          <OptionSelect value={part} onValueChange={setPart} options={[{ value: "", label: "Servis berkala umum" }, ...parts]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KM saat servis" htmlFor="sv-odo" required>
            <Input id="sv-odo" name="odometer" type="number" min={0} defaultValue={vehicle.odometer} required />
          </Field>
          <Field label="Tanggal" htmlFor="sv-date" required>
            <Input id="sv-date" name="serviced_at" type="date" defaultValue={getLocalDateString()} required />
          </Field>
          <Field label="Biaya (Rp)" htmlFor="sv-cost">
            <Input id="sv-cost" name="cost" type="number" min={0} defaultValue={0} />
          </Field>
        </div>
        {part && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="general" />
            Sekaligus servis berkala (reset hitungan interval)
          </label>
        )}
        <Field label="Catatan" htmlFor="sv-notes">
          <Textarea id="sv-notes" name="notes" rows={2} />
        </Field>
      </FormDialog>
      <VehicleFormDialog
        vehicle={vehicle}
        companies={companies}
        sites={sites}
        trigger={
          <Button>
            <Pencil />
            Edit
          </Button>
        }
      />
      <ConfirmButton
        destructive
        title={`Hapus ${vehicle.plate}?`}
        description="Riwayat P2H, BBM, dan perbaikan ikut terhapus. Kendaraan yang dijual sebaiknya diubah ke status Nonaktif."
        confirmText="Hapus"
        onConfirm={async () => {
          const ok = await run(() => deleteVehicle(vehicle.id), { refresh: false });
          if (ok) router.push("/fleet/vehicles");
          return ok;
        }}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Hapus kendaraan" title="Hapus">
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}
