"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { useAction } from "@/hooks/use-action";
import { deleteSop, saveSop } from "@/lib/actions/sop";

type Sop = { id: string; title: string; content_md: string; sort: number };

export function SopEditButton({ module, sop, nextSort }: { module: string; sop?: Sop; nextSort?: number }) {
  const { run } = useAction();
  return (
    <FormDialog
      trigger={
        sop ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${sop.title}`} title="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Tambah SOP
          </Button>
        )
      }
      title={sop ? "Edit SOP" : "Tambah SOP"}
      description="Isi mendukung Markdown: **tebal**, daftar 1. 2. 3., tabel | a | b |."
      onSubmit={(fd) => run(() => saveSop(fd))}
      className="sm:max-w-3xl"
    >
      {sop && <input type="hidden" name="id" value={sop.id} />}
      <input type="hidden" name="module" value={module} />
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Judul" htmlFor="sop-title" required>
          <Input id="sop-title" name="title" defaultValue={sop?.title} required maxLength={150} />
        </Field>
        <Field label="Urutan" htmlFor="sop-sort">
          <Input id="sop-sort" name="sort" type="number" defaultValue={sop?.sort ?? nextSort ?? 0} />
        </Field>
      </div>
      <Field label="Isi" htmlFor="sop-content">
        <Textarea id="sop-content" name="content_md" defaultValue={sop?.content_md} rows={14} className="font-mono text-sm" />
      </Field>
    </FormDialog>
  );
}

export function SopDeleteButton({ module, sop }: { module: string; sop: Sop }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      destructive
      title={`Hapus "${sop.title}"?`}
      confirmText="Hapus"
      onConfirm={() => run(() => deleteSop(sop.id, module))}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Hapus ${sop.title}`} title="Hapus">
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  );
}
