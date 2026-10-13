"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { cancelRepair, completeRepair, reportRepair, startRepair } from "./actions";

export function ReportRepairDialog({ vehicles }: { vehicles: Option[] }) {
  const { run } = useAction();
  const [vehicle, setVehicle] = useState("");
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Lapor Kerusakan
        </Button>
      }
      title="Lapor kerusakan"
      onSubmit={(fd) => run(() => reportRepair(fd))}
    >
      <input type="hidden" name="vehicle_id" value={vehicle} />
      <Field label="Kendaraan" required>
        <OptionSelect value={vehicle} onValueChange={setVehicle} options={vehicles} placeholder="Pilih kendaraan" />
      </Field>
      <Field label="Komponen" htmlFor="rp-comp" required>
        <Input id="rp-comp" name="component" required maxLength={120} placeholder="Mis. Lampu rem kiri" />
      </Field>
      <Field label="Keterangan" htmlFor="rp-desc">
        <Textarea id="rp-desc" name="description" rows={2} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_critical" />
        Kritis: kendaraan tidak boleh jalan sampai diperbaiki
      </label>
    </FormDialog>
  );
}

export function RepairRowActions({ id, code, status, parts }: { id: string; code: string; status: string; parts: Option[] }) {
  const { run } = useAction();
  const [part, setPart] = useState("");
  if (status === "done" || status === "cancelled") return null;
  return (
    <div className="flex justify-end gap-1">
      {status === "queued" && (
        <FormDialog
          trigger={
            <Button size="sm" variant="outline">
              <Wrench />
              Kerjakan
            </Button>
          }
          title={`Mulai ${code}`}
          onSubmit={(fd) => run(() => startRepair(fd))}
        >
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mekanik" htmlFor={`m-${id}`}>
              <Input id={`m-${id}`} name="mechanic" />
            </Field>
            <Field label="Bengkel" htmlFor={`w-${id}`}>
              <Input id={`w-${id}`} name="workshop" />
            </Field>
            <Field label="Estimasi biaya (Rp)" htmlFor={`e-${id}`}>
              <Input id={`e-${id}`} name="estimated_cost" type="number" min={0} />
            </Field>
          </div>
        </FormDialog>
      )}
      <FormDialog
        trigger={
          <Button size="sm">
            <CheckCircle2 />
            Selesai
          </Button>
        }
        title={`Selesaikan ${code}`}
        description="Biaya & part dicatat ke riwayat servis kendaraan."
        onSubmit={(fd) => run(() => completeRepair(fd))}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="part_id" value={part} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Biaya aktual (Rp)" htmlFor={`c-${id}`} required>
            <Input id={`c-${id}`} name="actual_cost" type="number" min={0} required />
          </Field>
          <Field label="Mekanik / bengkel" htmlFor={`mm-${id}`} required>
            <Input id={`mm-${id}`} name="mechanic" required />
          </Field>
        </div>
        <Field label="Termasuk penggantian part" hint="Pilih kalau perbaikan ini mengganti part terjadwal (mis. kampas rem), supaya prediksi servis berikutnya akurat.">
          <OptionSelect value={part} onValueChange={setPart} options={[{ value: "", label: "Tidak" }, ...parts]} />
        </Field>
      </FormDialog>
      <ConfirmButton
        title={`Batalkan ${code}?`}
        description="Misalnya laporan ternyata keliru."
        confirmText="Batalkan"
        onConfirm={() => run(() => cancelRepair(id))}
        trigger={
          <Button size="sm" variant="ghost" aria-label={`Batalkan ${code}`} title="Batalkan">
            <Ban />
          </Button>
        }
      />
    </div>
  );
}
