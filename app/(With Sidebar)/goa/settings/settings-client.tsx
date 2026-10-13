"use client";

import { useState } from "react";
import { Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { KPI_KEYS, type KpiParam } from "@/lib/goa/types";
import { formatDate } from "@/lib/utils";
import { addCategory, addHoliday, deleteCategory, deleteHoliday, resetKpi, saveKpi } from "./actions";

export function KpiEditor({ settings, members }: { settings: { target: string; parameters: KpiParam[] }[]; members: Option[] }) {
  const { run, pending } = useAction();
  const [target, setTarget] = useState("GLOBAL");
  const base = settings.find((s) => s.target === target)?.parameters ?? settings.find((s) => s.target === "GLOBAL")?.parameters ?? [];
  const [params, setParams] = useState<KpiParam[]>(base);
  const custom = target !== "GLOBAL" && settings.some((s) => s.target === target);

  const pick = (t: string) => {
    setTarget(t);
    setParams(settings.find((s) => s.target === t)?.parameters ?? settings.find((s) => s.target === "GLOBAL")?.parameters ?? []);
  };
  const on = (key: string) => params.some((p) => p.key === key);
  const total = params.reduce((a, p) => a + p.weight, 0);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <OptionSelect
          value={target}
          onValueChange={pick}
          options={[
            { value: "GLOBAL", label: "Global (semua anggota)" },
            ...members.map((m) => ({ ...m, description: settings.some((s) => s.target === m.value) ? "khusus" : undefined })),
          ]}
        />
      </div>
      <ul className="divide-y rounded-lg border">
        {KPI_KEYS.map((k) => {
          const p = params.find((x) => x.key === k.key);
          return (
            <li key={k.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={on(k.key)}
                  onCheckedChange={(v) =>
                    setParams(v === true ? [...params, { key: k.key, label: k.label, weight: 1 }] : params.filter((x) => x.key !== k.key))
                  }
                />
                <span>
                  <span className="text-sm font-medium">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.desc}</span>
                </span>
              </label>
              {p && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Bobot</span>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={p.weight}
                    onChange={(e) => setParams(params.map((x) => (x.key === k.key ? { ...x, weight: Number(e.target.value) } : x)))}
                    className="w-20"
                    aria-label={`Bobot ${k.label}`}
                  />
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{total ? Math.round((p.weight / total) * 100) : 0}%</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(() => saveKpi(target, params))} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Simpan {target === "GLOBAL" ? "bobot global" : "bobot khusus"}
        </Button>
        {custom && (
          <Button variant="outline" onClick={() => run(() => resetKpi(target)).then((ok) => ok && pick(target))} disabled={pending}>
            <RotateCcw />
            Pakai bobot global
          </Button>
        )}
      </div>
    </div>
  );
}

export function CategoryEditor({ categories }: { categories: string[] }) {
  const { run, pending } = useAction();
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <form
        className="flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addCategory(name)).then((ok) => ok && setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kategori baru" aria-label="Kategori baru" />
        <Button type="submit" disabled={pending}>
          <Plus />
          Tambah
        </Button>
      </form>
      <ul className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <li key={c} className="inline-flex h-7 items-center gap-1 rounded-full border bg-background pl-2.5 pr-1 text-xs shadow-xs">
            {c}
            <button
              type="button"
              onClick={() => run(() => deleteCategory(c))}
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Hapus ${c}`}
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HolidayEditor({ holidays }: { holidays: { date: string; name: string }[] }) {
  const { run, pending } = useAction();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addHoliday(date, name)).then((ok) => ok && (setDate(""), setName("")));
        }}
      >
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" aria-label="Tanggal" required />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama hari libur" aria-label="Nama hari libur" required />
        <Button type="submit" disabled={pending}>
          <Plus />
          Tambah
        </Button>
      </form>
      <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
        {holidays.map((h) => (
          <li key={h.date} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span>
              <span className="tabular-nums text-muted-foreground">{formatDate(h.date)}</span> · {h.name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => run(() => deleteHoliday(h.date))} aria-label={`Hapus ${h.name}`}>
              <Trash2 className="text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
