"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Check, ClipboardCheck, Flag, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { cancelBooking, decideBooking, finishTrip, startTrip } from "../actions";

export function BookingActions({
  booking,
  drivers,
  perms,
  vehicleOdometer,
}: {
  booking: { id: string; code: string; status: string; driver_id: string | null; p2h_id: string | null; p2h_result: string | null };
  drivers: Option[];
  perms: { admin: boolean; isDriver: boolean; isRequester: boolean };
  vehicleOdometer: number;
}) {
  const { run } = useAction();
  const [driver, setDriver] = useState(booking.driver_id ?? "");
  const [override, setOverride] = useState(false);
  const { status } = booking;
  const canDrive = perms.admin || perms.isDriver;
  const p2hBlocks = !booking.p2h_id || booking.p2h_result === "grounded";

  return (
    <div className="flex flex-wrap gap-2">
      {perms.admin && status === "pending" && (
        <>
          <FormDialog
            trigger={
              <Button>
                <Check />
                Setujui
              </Button>
            }
            title={`Setujui ${booking.code}`}
            submitText="Setujui"
            onSubmit={(fd) => run(() => decideBooking(booking.id, true, driver, String(fd.get("note") ?? "")))}
          >
            <Field label="Driver" hint="Driver yang ditunjuk bisa mengisi P2H & memulai perjalanan.">
              <OptionSelect value={driver} onValueChange={setDriver} options={drivers} placeholder="Pilih driver" />
            </Field>
            <Field label="Catatan" htmlFor="bk-note">
              <Textarea id="bk-note" name="note" rows={2} />
            </Field>
          </FormDialog>
          <FormDialog
            trigger={
              <Button variant="outline">
                <X />
                Tolak
              </Button>
            }
            title={`Tolak ${booking.code}`}
            submitText="Tolak"
            onSubmit={(fd) => run(() => decideBooking(booking.id, false, undefined, String(fd.get("note") ?? "")))}
          >
            <Field label="Alasan" htmlFor="bk-rej" required>
              <Textarea id="bk-rej" name="note" rows={2} required />
            </Field>
          </FormDialog>
        </>
      )}

      {status === "approved" && canDrive && (
        <>
          {!booking.p2h_id && (
            <Button asChild>
              <Link href={`/fleet/p2h?booking=${booking.id}`}>
                <ClipboardCheck />
                Isi P2H
              </Link>
            </Button>
          )}
          <FormDialog
            trigger={
              <Button variant={booking.p2h_id ? "default" : "outline"} disabled={p2hBlocks && !perms.admin}>
                <Play />
                Mulai perjalanan
              </Button>
            }
            title="Mulai perjalanan?"
            description="Status kendaraan menjadi Dipakai dan GPS mulai dikirim dari perangkat ini."
            submitText="Mulai"
            onSubmit={() => run(() => startTrip(booking.id, override))}
          >
            {p2hBlocks && perms.admin ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={override} onCheckedChange={(v) => setOverride(v === true)} className="mt-0.5" />
                <span>
                  {booking.p2h_result === "grounded" ? "P2H menyatakan TIDAK LAYAK." : "P2H belum diisi."} Tetap izinkan berangkat
                  (override admin, tercatat).
                </span>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">P2H sudah diisi. Pastikan halaman ini tetap terbuka selama perjalanan.</p>
            )}
          </FormDialog>
        </>
      )}

      {status === "in_use" && canDrive && (
        <FormDialog
          trigger={
            <Button>
              <Flag />
              Selesai
            </Button>
          }
          title="Selesaikan perjalanan"
          submitText="Selesai"
          onSubmit={(fd) => run(() => finishTrip(booking.id, Number(fd.get("end_odo"))))}
        >
          <Field label="KM akhir (odometer)" htmlFor="end-odo" required>
            <Input id="end-odo" name="end_odo" type="number" min={vehicleOdometer} defaultValue={vehicleOdometer} required />
          </Field>
        </FormDialog>
      )}

      {(status === "pending" || status === "approved") && (perms.admin || perms.isRequester) && (
        <ConfirmButton
          destructive
          title={`Batalkan ${booking.code}?`}
          confirmText="Batalkan booking"
          onConfirm={() => run(() => cancelBooking(booking.id))}
          trigger={
            <Button variant="ghost">
              <Ban />
              Batalkan
            </Button>
          }
        />
      )}
    </div>
  );
}
