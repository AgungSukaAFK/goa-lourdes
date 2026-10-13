"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { estimateTrip, haversineKm, type CostSettings } from "@/lib/fleet/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { createBooking } from "./actions";

const DestinationPicker = dynamic(() => import("@/components/map/destination-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

type CompanyOpt = Option & { company: string };

function nowLocal(addHours = 0) {
  const d = new Date(Date.now() + addHours * 3600000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function BookingFormDialog({
  vehicles,
  employees,
  drivers,
  cost,
  isAdmin,
  myEmployeeId,
}: {
  vehicles: (CompanyOpt & { status: string })[];
  employees: CompanyOpt[];
  drivers: CompanyOpt[];
  cost: CostSettings;
  isAdmin: boolean;
  myEmployeeId: string | null;
}) {
  const { run } = useAction();
  const router = useRouter();
  const [vehicle, setVehicle] = useState("");
  const [requester, setRequester] = useState(myEmployeeId ?? "");
  const [driver, setDriver] = useState("");
  const [dest, setDest] = useState<[number, number] | null>(null);
  const company = vehicles.find((v) => v.value === vehicle)?.company;
  const usable = vehicles.filter((v) => !["grounded", "maintenance", "inactive"].includes(v.status));
  const forCo = <T extends { company: string }>(l: T[]) => (company ? l.filter((x) => x.company === company || x.company === "LOURDES") : l);
  const dist = dest ? haversineKm(cost.poolLat, cost.poolLng, dest[0], dest[1]) : null;
  const est = dist !== null ? estimateTrip(dist, cost) : null;

  if (!isAdmin && !myEmployeeId) {
    return (
      <Button disabled title="Akun Anda belum terhubung ke data karyawan. Hubungi admin.">
        <Plus />
        Booking Unit
      </Button>
    );
  }

  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Booking Unit
        </Button>
      }
      title="Booking kendaraan"
      description="Klik peta untuk menandai tujuan; estimasi jarak & biaya dihitung dari pool."
      onSubmit={async (fd) => {
        let id: string | undefined;
        const okk = await run(() => createBooking(fd), { onSuccess: (d) => (id = d?.id) });
        if (okk && id) router.push(`/fleet/bookings/${id}`);
        return okk;
      }}
      className="sm:max-w-3xl"
    >
      <input type="hidden" name="vehicle_id" value={vehicle} />
      <input type="hidden" name="requester_employee_id" value={requester} />
      <input type="hidden" name="driver_id" value={driver} />
      <input type="hidden" name="dest_lat" value={dest?.[0] ?? ""} />
      <input type="hidden" name="dest_lng" value={dest?.[1] ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kendaraan" required>
          <OptionSelect value={vehicle} onValueChange={setVehicle} options={usable} placeholder="Pilih kendaraan" />
        </Field>
        <Field label="Pemohon" required>
          <OptionSelect value={requester} onValueChange={setRequester} options={forCo(employees)} disabled={!isAdmin} placeholder="Pilih karyawan" />
        </Field>
        <Field label="Berangkat" htmlFor="bk-start" required>
          <Input id="bk-start" name="start_time" type="datetime-local" defaultValue={nowLocal(1)} required />
        </Field>
        <Field label="Kembali" htmlFor="bk-end" required>
          <Input id="bk-end" name="end_time" type="datetime-local" defaultValue={nowLocal(5)} required />
        </Field>
        <Field label="Tujuan" htmlFor="bk-dest" required>
          <Input id="bk-dest" name="destination" required maxLength={200} placeholder="Nama tempat / alamat" />
        </Field>
        {isAdmin ? (
          <Field label="Driver" hint="Bisa juga ditentukan saat menyetujui.">
            <OptionSelect value={driver} onValueChange={setDriver} options={[{ value: "", label: "Belum ditentukan", company: "" }, ...forCo(drivers)]} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Keperluan" htmlFor="bk-purpose" required className="sm:col-span-2">
          <Textarea id="bk-purpose" name="purpose" rows={2} required maxLength={500} />
        </Field>
      </div>
      <DestinationPicker pool={[cost.poolLat, cost.poolLng]} value={dest} onPick={(a, b) => setDest([a, b])} />
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3 text-sm sm:grid-cols-4 dark:bg-muted/10">
        <div>
          <p className="text-xs text-muted-foreground">Jarak (garis lurus)</p>
          <p className="font-medium tabular-nums">{dist !== null ? `${formatNumber(dist, 1)} km` : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">BBM PP</p>
          <p className="font-medium tabular-nums">{est ? `${est.liters} L · ${formatCurrency(est.fuel)}` : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tol (perkiraan)</p>
          <p className="font-medium tabular-nums">{est ? formatCurrency(est.toll) : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total estimasi</p>
          <p className="font-semibold tabular-nums">{est ? formatCurrency(est.total) : "-"}</p>
        </div>
      </div>
    </FormDialog>
  );
}
