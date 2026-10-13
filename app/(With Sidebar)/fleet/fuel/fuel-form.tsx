"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { getLocalDateString } from "@/lib/utils";
import { deleteFuel, saveFuel } from "./actions";

export function FuelFormDialog({
  vehicles,
  drivers,
  isAdmin,
  defaultVehicle,
}: {
  vehicles: (Option & { odometer: number })[];
  drivers: Option[];
  isAdmin: boolean;
  defaultVehicle?: string;
}) {
  const { run } = useAction();
  const [vehicle, setVehicle] = useState(defaultVehicle ?? "");
  const [driver, setDriver] = useState("");
  const [start, setStart] = useState(String(vehicles.find((v) => v.value === defaultVehicle)?.odometer ?? ""));
  const [end, setEnd] = useState("");
  const [liters, setLiters] = useState("");
  const ratio = Number(end) > Number(start) && Number(liters) > 0 ? (Number(end) - Number(start)) / Number(liters) : null;

  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Catat Pengisian
        </Button>
      }
      title="Catat pengisian BBM"
      onSubmit={(fd) => run(() => saveFuel(fd))}
    >
      <input type="hidden" name="vehicle_id" value={vehicle} />
      <input type="hidden" name="driver_id" value={driver} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kendaraan" required>
          <OptionSelect
            value={vehicle}
            onValueChange={(v) => {
              setVehicle(v);
              setStart(String(vehicles.find((x) => x.value === v)?.odometer ?? ""));
            }}
            options={vehicles}
            placeholder="Pilih kendaraan"
          />
        </Field>
        {isAdmin ? (
          <Field label="Driver">
            <OptionSelect value={driver} onValueChange={setDriver} options={[{ value: "", label: "-" }, ...drivers]} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Tanggal" htmlFor="f-date" required>
          <Input id="f-date" name="date" type="date" defaultValue={getLocalDateString()} required />
        </Field>
        <Field label="Total biaya (Rp)" htmlFor="f-cost" required>
          <Input id="f-cost" name="total_cost" type="number" min={0} required />
        </Field>
        <Field label="KM pengisian sebelumnya" htmlFor="f-start" required>
          <Input id="f-start" name="start_odo" type="number" min={0} value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="KM sekarang" htmlFor="f-end" required>
          <Input id="f-end" name="end_odo" type="number" min={0} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
        <Field label="Liter" htmlFor="f-l" required>
          <Input id="f-l" name="liters" type="number" min={0.1} step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} required />
        </Field>
        <div className="flex items-end">
          <p className="text-sm text-muted-foreground">
            Rasio: <span className="font-medium text-foreground tabular-nums">{ratio ? `${ratio.toFixed(2)} km/L` : "-"}</span>
          </p>
        </div>
      </div>
    </FormDialog>
  );
}

export function FuelDelete({ id }: { id: string }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      destructive
      title="Hapus data BBM ini?"
      confirmText="Hapus"
      onConfirm={() => run(() => deleteFuel(id))}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Hapus" title="Hapus">
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  );
}
