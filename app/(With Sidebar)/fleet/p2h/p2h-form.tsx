"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CheckCheck, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { StatusBadge } from "@/components/status-badge";
import { FLEET_P2H_RESULT } from "@/lib/status";
import { uploadFile } from "@/lib/upload";
import { cn, formatNumber } from "@/lib/utils";
import type { P2hItem } from "@/lib/fleet/types";
import { submitP2h } from "./actions";

type VehicleOpt = Option & { company: string; odometer: number };
type Side = "front" | "back" | "left" | "right";
const SIDES: { key: Side; label: string }[] = [
  { key: "front", label: "Depan" },
  { key: "back", label: "Belakang" },
  { key: "left", label: "Kiri" },
  { key: "right", label: "Kanan" },
];

export function P2hForm({
  items,
  vehicles,
  drivers,
  inspectors,
  booking,
  defaultVehicle,
  defaultDriver,
  lockDriver,
}: {
  items: P2hItem[];
  vehicles: VehicleOpt[];
  drivers: Option[];
  inspectors: Option[];
  booking: { id: string; code: string; vehicle_id: string; driver_id: string | null } | null;
  defaultVehicle: string;
  defaultDriver: string;
  lockDriver: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"pre_trip" | "weekly">(booking ? "pre_trip" : "weekly");
  const [vehicle, setVehicle] = useState(booking?.vehicle_id ?? defaultVehicle);
  const [driver, setDriver] = useState(booking?.driver_id ?? defaultDriver);
  const [inspector, setInspector] = useState("");
  const v = vehicles.find((x) => x.value === vehicle);
  const [odo, setOdo] = useState<string>(v ? String(v.odometer) : "");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Partial<Record<Side, { path: string; preview: string }>>>({});
  const [uploading, setUploading] = useState<Side | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRefs = useRef<Partial<Record<Side, HTMLInputElement | null>>>({});

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);
  useEffect(() => {
    if (v) setOdo(String(v.odometer));
  }, [vehicle]);

  const groups = useMemo(() => {
    const g = new Map<string, P2hItem[]>();
    for (const it of items) {
      const key = `${it.target === "driver" ? "Driver" : "Kendaraan"} · ${it.category}`;
      g.set(key, [...(g.get(key) ?? []), it]);
    }
    return [...g.entries()];
  }, [items]);

  const answered = Object.keys(answers).length;
  const failed = items.filter((i) => answers[i.id] === false);
  const score = Math.max(0, 100 - failed.reduce((a, i) => a + i.weight, 0));
  const critical = failed.some((i) => i.is_critical);
  const result = critical || score < 70 ? "grounded" : score < 100 ? "caution" : "fit";

  const onPhoto = async (side: Side, file?: File) => {
    if (!file || !v) return;
    setUploading(side);
    try {
      const path = await uploadFile("p2h-photos", `${v.company}/${v.value}`, file);
      setPhotos((p) => ({ ...p, [side]: { path, preview: URL.createObjectURL(file) } }));
    } catch {
      toast.error("Upload foto gagal. Coba lagi.");
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!vehicle || !driver) return toast.warning("Pilih kendaraan dan driver.");
    if (!odo) return toast.warning("Isi KM kendaraan.");
    if (answered < items.length) return toast.warning(`Masih ada ${items.length - answered} item yang belum dijawab.`);
    const missing = SIDES.filter((s) => !photos[s.key]);
    if (missing.length) return toast.warning(`Foto ${missing.map((m) => m.label.toLowerCase()).join(", ")} belum ada.`);
    setBusy(true);
    const res = await submitP2h({
      vehicle_id: vehicle,
      driver_id: driver,
      kind,
      booking_id: booking?.id ?? null,
      odometer: Number(odo),
      inspector: inspectors.find((i) => i.value === inspector)?.label ?? null,
      notes: notes || null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      answers: items.map((i) => ({ item_id: i.id, ok: answers[i.id] })),
      photos: SIDES.map((s) => ({ side: s.key, path: photos[s.key]!.path })),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message);
    router.push(booking ? `/fleet/bookings/${booking.id}` : `/fleet/p2h/history/${res.data!.id}`);
  };

  return (
    <div className="col-span-12 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{booking ? `P2H pra-perjalanan · ${booking.code}` : "Isi P2H"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {!booking && (
              <Field label="Jenis P2H">
                <OptionSelect
                  value={kind}
                  onValueChange={(x) => setKind(x as typeof kind)}
                  options={[
                    { value: "weekly", label: "Rutin mingguan" },
                    { value: "pre_trip", label: "Sebelum perjalanan (tanpa booking)" },
                  ]}
                />
              </Field>
            )}
            <Field label="Kendaraan" required>
              <OptionSelect value={vehicle} onValueChange={setVehicle} options={vehicles} disabled={!!booking} placeholder="Pilih kendaraan" />
            </Field>
            <Field label="Driver" required>
              <OptionSelect value={driver} onValueChange={setDriver} options={drivers} disabled={lockDriver || !!booking?.driver_id} placeholder="Pilih driver" />
            </Field>
            <Field label="KM saat ini" htmlFor="p2h-odo" required hint={v ? `KM terakhir tercatat: ${formatNumber(v.odometer)}` : undefined}>
              <Input id="p2h-odo" type="number" inputMode="numeric" min={0} value={odo} onChange={(e) => setOdo(e.target.value)} />
            </Field>
            {inspectors.length > 0 && (
              <Field label="Pemeriksa">
                <OptionSelect value={inspector} onValueChange={setInspector} options={[{ value: "", label: "-" }, ...inspectors]} />
              </Field>
            )}
          </CardContent>
        </Card>

        {groups.map(([title, list]) => {
          const allOk = list.every((i) => answers[i.id] === true);
          return (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnswers((a) => ({ ...a, ...Object.fromEntries(list.map((i) => [i.id, true])) }))}
                  disabled={allOk}
                >
                  <CheckCheck />
                  Semua baik
                </Button>
              </CardHeader>
              <CardContent className="divide-y">
                {list.map((it) => {
                  const a = answers[it.id];
                  return (
                    <div key={it.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {it.name}
                          {it.is_critical && <span className="ml-1.5 text-[11px] font-medium text-red-700 dark:text-red-300">kritis</span>}
                        </p>
                        {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={it.name}>
                        <Button
                          type="button"
                          size="sm"
                          variant={a === true ? "default" : "outline"}
                          role="radio"
                          aria-checked={a === true}
                          onClick={() => setAnswers((x) => ({ ...x, [it.id]: true }))}
                        >
                          <Check />
                          Baik
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={a === false ? "destructive" : "outline"}
                          role="radio"
                          aria-checked={a === false}
                          onClick={() => setAnswers((x) => ({ ...x, [it.id]: false }))}
                        >
                          <X />
                          Tidak
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto kendaraan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SIDES.map((s) => {
              const ph = photos[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => fileRefs.current[s.key]?.click()}
                  disabled={!v || uploading !== null}
                  className={cn(
                    "relative flex aspect-[4/3] flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    !ph && "border-dashed",
                  )}
                >
                  <input
                    ref={(el) => {
                      fileRefs.current[s.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onPhoto(s.key, e.target.files?.[0])}
                  />
                  {ph ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ph.preview} alt={`Foto ${s.label}`} className="absolute inset-0 h-full w-full object-cover" />
                  ) : uploading === s.key ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5" />
                  )}
                  <span className={cn("relative z-10", ph && "rounded bg-background/90 px-1.5 text-xs text-foreground")}>{s.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Field label="Catatan tambahan" htmlFor="p2h-notes">
              <Textarea id="p2h-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Hasil sementara</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <p className="text-4xl font-semibold tabular-nums">{score}</p>
            <StatusBadge map={FLEET_P2H_RESULT} value={answered ? result : null} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${(answered / items.length) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {answered} dari {items.length} item dijawab · {Object.keys(photos).length}/4 foto
          </p>
          {failed.length > 0 && (
            <ul className="space-y-1 text-sm">
              {failed.map((f) => (
                <li key={f.id} className="flex items-start gap-1.5">
                  <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    {f.name}
                    {f.is_critical && <span className="text-xs text-muted-foreground"> (kritis)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result === "grounded" && answered > 0 && (
            <p className="text-sm text-red-700 dark:text-red-300">
              Kendaraan <b>tidak layak jalan</b>. Item kendaraan yang gagal otomatis masuk daftar perbaikan.
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {geo ? `Lokasi tercatat (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})` : "Lokasi belum didapat (opsional)"}
          </p>
          <Button className="w-full" onClick={submit} disabled={busy || uploading !== null}>
            {busy && <Loader2 className="animate-spin" />}
            Simpan P2H
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
