"use client";

import { useState } from "react";
import { Ban, CalendarPlus, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { DOW } from "@/lib/goa/schedule";
import { deleteTemplate, runToday, saveTemplate, setTemplateActive } from "./actions";

export type Template = {
  id: string;
  title: string;
  description: string | null;
  job_category: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
  frequency: "daily" | "weekly" | "monthly";
  days: number[];
  due_time: string;
  company: string;
  skip_holidays: boolean;
  is_active: boolean;
};


export function TemplateDialog({
  template,
  members,
  categories,
  companies,
}: {
  template?: Template;
  members: Option[];
  categories: string[];
  companies: Option[];
}) {
  const { run } = useAction();
  const [freq, setFreq] = useState<string>(template?.frequency ?? "weekly");
  const [days, setDays] = useState<number[]>(template?.days ?? [1, 2, 3, 4, 5]);
  const [assignee, setAssignee] = useState(template?.assignee_id ?? "");
  const [reviewer, setReviewer] = useState(template?.reviewer_id ?? "");
  const [category, setCategory] = useState(template?.job_category ?? categories[0] ?? "");
  const [company, setCompany] = useState(template?.company ?? companies[0]?.value ?? "LOURDES");
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort((a, b) => a - b)));

  return (
    <FormDialog
      trigger={
        template ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${template.title}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Template Baru
          </Button>
        )
      }
      title={template ? "Edit template" : "Template tugas rutin"}
      onSubmit={(fd) => run(() => saveTemplate(fd))}
      className="sm:max-w-xl"
    >
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="frequency" value={freq} />
      <input type="hidden" name="days" value={days.join(",")} />
      <input type="hidden" name="assignee_id" value={assignee} />
      <input type="hidden" name="reviewer_id" value={reviewer} />
      <input type="hidden" name="job_category" value={category} />
      <input type="hidden" name="company" value={company} />
      <Field label="Judul tugas" htmlFor="tp-title" required>
        <Input id="tp-title" name="title" defaultValue={template?.title} required />
      </Field>
      <Field label="Deskripsi" htmlFor="tp-desc">
        <Textarea id="tp-desc" name="description" defaultValue={template?.description ?? ""} rows={2} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PIC">
          <OptionSelect value={assignee} onValueChange={setAssignee} options={[{ value: "", label: "General Pool" }, ...members]} />
        </Field>
        <Field label="Reviewer">
          <OptionSelect value={reviewer} onValueChange={setReviewer} options={[{ value: "", label: "Atasan mana saja" }, ...members]} />
        </Field>
        <Field label="Kategori">
          <OptionSelect value={category} onValueChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="PT">
          <OptionSelect value={company} onValueChange={setCompany} options={companies} />
        </Field>
        <Field label="Frekuensi">
          <OptionSelect
            value={freq}
            onValueChange={(v) => {
              setFreq(v);
              setDays(v === "monthly" ? [1] : [1, 2, 3, 4, 5]);
            }}
            options={[
              { value: "daily", label: "Setiap hari" },
              { value: "weekly", label: "Hari tertentu tiap minggu" },
              { value: "monthly", label: "Tanggal tertentu tiap bulan" },
            ]}
          />
        </Field>
        <Field label="Batas jam" htmlFor="tp-time">
          <Input id="tp-time" name="due_time" type="time" defaultValue={template?.due_time?.slice(0, 5) ?? "17:00"} required />
        </Field>
      </div>
      {freq === "weekly" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hari">
          {DOW.map((d, i) => (
            <Button key={d} type="button" size="sm" variant={days.includes(i) ? "default" : "outline"} aria-pressed={days.includes(i)} onClick={() => toggle(i)}>
              {d}
            </Button>
          ))}
        </div>
      )}
      {freq === "monthly" && (
        <Field label="Tanggal (pisahkan koma)" htmlFor="tp-days" hint="Tanggal 31 di bulan pendek dijalankan di hari terakhir bulan.">
          <Input
            id="tp-days"
            defaultValue={days.join(", ")}
            onChange={(e) => setDays(e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => n >= 1 && n <= 31))}
          />
        </Field>
      )}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="skip_holidays" defaultChecked={template?.skip_holidays ?? true} />
          Lewati hari libur nasional
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_active" defaultChecked={template?.is_active ?? true} />
          Aktif
        </label>
      </div>
    </FormDialog>
  );
}

export function TemplateActions({ template, members, categories, companies }: { template: Template; members: Option[]; categories: string[]; companies: Option[] }) {
  const { run } = useAction();
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => run(() => setTemplateActive(template.id, !template.is_active))}
        aria-label={template.is_active ? "Blokir" : "Aktifkan"}
        title={template.is_active ? "Blokir" : "Aktifkan"}
      >
        {template.is_active ? <Ban /> : <Play />}
      </Button>
      <TemplateDialog template={template} members={members} categories={categories} companies={companies} />
      <ConfirmButton
        destructive
        title={`Hapus template "${template.title}"?`}
        description="Tugas yang sudah dibuat dari template ini tetap ada."
        confirmText="Hapus"
        onConfirm={() => run(() => deleteTemplate(template.id))}
        trigger={
          <Button variant="ghost" size="sm" aria-label="Hapus">
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}

export function RunTodayButton() {
  const { run, pending } = useAction();
  return (
    <Button variant="outline" onClick={() => run(() => runToday())} disabled={pending}>
      <CalendarPlus />
      Buat tugas hari ini
    </Button>
  );
}

export function DayDots({ t }: { t: Template }) {
  if (t.frequency !== "weekly") return null;
  return (
    <div className="mt-1 flex gap-0.5" aria-hidden="true">
      {DOW.map((d, i) => (
        <span key={d} className={cn("flex size-5 items-center justify-center rounded text-[9px]", t.days.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {d[0]}
        </span>
      ))}
    </div>
  );
}
