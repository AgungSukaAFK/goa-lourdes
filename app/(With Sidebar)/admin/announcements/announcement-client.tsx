"use client";

import { useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { createAnnouncement, deleteAnnouncement } from "./actions";

export function AnnouncementDialog() {
  const { run } = useAction();
  const [company, setCompany] = useState("ALL");
  const [mod, setMod] = useState("ALL");
  return (
    <FormDialog
      trigger={
        <Button>
          <Megaphone />
          Buat Pengumuman
        </Button>
      }
      title="Pengumuman"
      description="Muncul di lonceng notifikasi penerima secara realtime."
      onSubmit={(fd) => run(() => createAnnouncement(fd))}
    >
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="module" value={mod} />
      <Field label="Judul" htmlFor="an-title" required>
        <Input id="an-title" name="title" required maxLength={150} />
      </Field>
      <Field label="Isi" htmlFor="an-body">
        <Textarea id="an-body" name="body" rows={3} maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Untuk PT">
          <OptionSelect value={company} onValueChange={setCompany} options={[{ value: "ALL", label: "Semua" }, { value: "GMI", label: "GMI" }, { value: "GIS", label: "GIS" }]} />
        </Field>
        <Field label="Pengguna modul">
          <OptionSelect
            value={mod}
            onValueChange={setMod}
            options={[{ value: "ALL", label: "Semua" }, { value: "asset", label: "Asset" }, { value: "fleet", label: "Fleet" }, { value: "goa", label: "GOA" }]}
          />
        </Field>
        <Field label="Tampil (hari)" htmlFor="an-days">
          <Input id="an-days" name="days" type="number" min={1} max={90} defaultValue={7} />
        </Field>
      </div>
      <Field label="Link (opsional)" htmlFor="an-link" hint="Mis. /fleet/sop">
        <Input id="an-link" name="link" placeholder="/..." />
      </Field>
    </FormDialog>
  );
}

export function AnnouncementDelete({ id }: { id: string }) {
  const { run } = useAction();
  return (
    <Button variant="ghost" size="sm" aria-label="Hapus" onClick={() => run(() => deleteAnnouncement(id))}>
      <Trash2 className="text-destructive" />
    </Button>
  );
}
