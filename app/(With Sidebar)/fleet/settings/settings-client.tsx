"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { MultiOptionSelect } from "@/components/multi-option-select";
import { ToneBadge } from "@/components/status-badge";
import { useAction } from "@/hooks/use-action";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { CostSettings, P2hItem, Part } from "@/lib/fleet/types";
import { deleteInspector, deletePart, saveCost, saveInspector, savePart, saveP2hItem } from "./actions";

const SOURCE: Record<string, string> = { tax_date: "Tanggal pajak", kir_date: "Tanggal KIR", plate_date: "Tanggal plat" };

function PartDialog({ part, vehicles }: { part?: Part; vehicles: Option[] }) {
  const { run } = useAction();
  const [type, setType] = useState<string>(part?.type ?? "km");
  const [src, setSrc] = useState<string>(part?.date_source ?? "");
  const [veh, setVeh] = useState<string[]>(part?.vehicle_ids ?? []);
  return (
    <FormDialog
      trigger={
        part ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${part.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus />
            Tambah Part
          </Button>
        )
      }
      title={part ? `Edit ${part.name}` : "Tambah part"}
      onSubmit={(fd) => run(() => savePart(fd))}
    >
      {part && <input type="hidden" name="id" value={part.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date_source" value={src} />
      <input type="hidden" name="vehicle_ids" value={veh.join(",")} />
      <Field label="Nama" htmlFor="pt-name" required>
        <Input id="pt-name" name="name" defaultValue={part?.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dasar interval">
          <OptionSelect value={type} onValueChange={setType} options={[{ value: "km", label: "Kilometer" }, { value: "days", label: "Hari" }]} />
        </Field>
        <Field label={type === "km" ? "Tiap (km)" : "Tiap (hari)"} htmlFor="pt-int" required>
          <Input id="pt-int" name="interval" type="number" min={1} defaultValue={part?.interval ?? (type === "km" ? 10000 : 365)} required />
        </Field>
        <Field label="Biaya (Rp)" htmlFor="pt-cost">
          <Input id="pt-cost" name="cost" type="number" min={0} defaultValue={part?.cost ?? 0} />
        </Field>
      </div>
      {type === "days" && (
        <Field label="Ikuti tanggal dokumen" hint="Kosong = dihitung dari riwayat servis terakhir.">
          <OptionSelect value={src} onValueChange={setSrc} options={[{ value: "", label: "Tidak" }, ...Object.entries(SOURCE).map(([value, label]) => ({ value, label }))]} />
        </Field>
      )}
      <Field label="Berlaku untuk" hint="Kosong = semua kendaraan.">
        <MultiOptionSelect value={veh} onChange={setVeh} options={vehicles} placeholder="Semua kendaraan" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_active" defaultChecked={part?.is_active ?? true} />
        Aktif
      </label>
    </FormDialog>
  );
}

export function PartsTab({ parts, vehicles }: { parts: Part[]; vehicles: Option[] }) {
  const { run } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PartDialog vehicles={vehicles} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Part</TableHead>
            <TableHead>Interval</TableHead>
            <TableHead className="text-right">Biaya</TableHead>
            <TableHead>Berlaku</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {parts.map((p) => (
            <TableRow key={p.id} className={p.is_active ? undefined : "opacity-60"}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>
                {p.type === "km" ? `${formatNumber(p.interval)} km` : `${formatNumber(p.interval)} hari`}
                {p.date_source && <div className="text-xs text-muted-foreground">ikut {SOURCE[p.date_source].toLowerCase()}</div>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.cost)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.vehicle_ids?.length ? `${p.vehicle_ids.length} kendaraan` : "Semua"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <PartDialog part={p} vehicles={vehicles} />
                  <ConfirmButton
                    destructive
                    title={`Hapus ${p.name}?`}
                    confirmText="Hapus"
                    onConfirm={() => run(() => deletePart(p.id))}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Hapus ${p.name}`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ItemDialog({ item }: { item?: P2hItem }) {
  const { run } = useAction();
  const [target, setTarget] = useState<string>(item?.target ?? "vehicle");
  return (
    <FormDialog
      trigger={
        item ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${item.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus />
            Tambah Item
          </Button>
        )
      }
      title={item ? "Edit item checklist" : "Tambah item checklist"}
      description="Skor P2H = 100 − total bobot item yang gagal. Item kritis yang gagal = tidak layak jalan."
      onSubmit={(fd) => run(() => saveP2hItem(fd))}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="target" value={target} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Untuk">
          <OptionSelect value={target} onValueChange={setTarget} options={[{ value: "vehicle", label: "Kendaraan" }, { value: "driver", label: "Driver" }]} />
        </Field>
        <Field label="Kategori" htmlFor="it-cat" required>
          <Input id="it-cat" name="category" defaultValue={item?.category} required placeholder="Mesin / Rem / Kesehatan ..." />
        </Field>
        <Field label="Nama item" htmlFor="it-name" required className="sm:col-span-2">
          <Input id="it-name" name="name" defaultValue={item?.name} required />
        </Field>
        <Field label="Keterangan" htmlFor="it-desc" className="sm:col-span-2">
          <Input id="it-desc" name="description" defaultValue={item?.description ?? ""} />
        </Field>
        <Field label="Bobot" htmlFor="it-w" required>
          <Input id="it-w" name="weight" type="number" min={0} max={100} defaultValue={item?.weight ?? 2} required />
        </Field>
        <Field label="Urutan" htmlFor="it-s">
          <Input id="it-s" name="sort" type="number" defaultValue={item?.sort ?? 100} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_critical" defaultChecked={item?.is_critical ?? false} />
          Kritis
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_active" defaultChecked={item?.is_active ?? true} />
          Aktif
        </label>
      </div>
    </FormDialog>
  );
}

export function ChecklistTab({ items }: { items: P2hItem[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ItemDialog />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Untuk</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Bobot</TableHead>
            <TableHead />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id} className={i.is_active ? undefined : "opacity-60"}>
              <TableCell className="text-sm">{i.target === "driver" ? "Driver" : "Kendaraan"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.category}</TableCell>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell className="text-right tabular-nums">{i.weight}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {i.is_critical && <ToneBadge tone="red">Kritis</ToneBadge>}
                  {!i.is_active && <ToneBadge tone="gray">Nonaktif</ToneBadge>}
                </div>
              </TableCell>
              <TableCell>
                <ItemDialog item={i} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function InspectorsTab({ inspectors }: { inspectors: { id: string; name: string }[] }) {
  const { run, pending } = useAction();
  return (
    <div className="max-w-lg space-y-3">
      <form
        className="flex gap-2"
        action={(fd) => {
          run(() => saveInspector(fd));
        }}
      >
        <Input name="name" placeholder="Nama pemeriksa" required aria-label="Nama pemeriksa" />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Tambah
        </Button>
      </form>
      <ul className="divide-y rounded-lg border">
        {inspectors.length === 0 && <li className="p-3 text-sm text-muted-foreground">Belum ada pemeriksa.</li>}
        {inspectors.map((i) => (
          <li key={i.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
            {i.name}
            <Button variant="ghost" size="sm" aria-label={`Hapus ${i.name}`} onClick={() => run(() => deleteInspector(i.id))}>
              <Trash2 className="text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CostTab({ cost }: { cost: CostSettings }) {
  const { run, pending } = useAction();
  return (
    <form action={(fd) => void run(() => saveCost(fd))} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Harga BBM (Rp/L)" htmlFor="c-fuel">
          <Input id="c-fuel" name="fuelPrice" type="number" defaultValue={cost.fuelPrice} />
        </Field>
        <Field label="Konsumsi (km/L)" htmlFor="c-kpl">
          <Input id="c-kpl" name="kmPerLiter" type="number" step="0.1" defaultValue={cost.kmPerLiter} />
        </Field>
        <Field label="Tol (Rp/km)" htmlFor="c-toll">
          <Input id="c-toll" name="tollPerKm" type="number" defaultValue={cost.tollPerKm} />
        </Field>
        <Field label="Lintang pool" htmlFor="c-lat">
          <Input id="c-lat" name="poolLat" type="number" step="any" defaultValue={cost.poolLat} />
        </Field>
        <Field label="Bujur pool" htmlFor="c-lng">
          <Input id="c-lng" name="poolLng" type="number" step="any" defaultValue={cost.poolLng} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Estimasi booking = ⌈jarak × 2 ÷ km/L⌉ × harga BBM + jarak × tol/km.</p>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Simpan
      </Button>
    </form>
  );
}
