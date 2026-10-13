"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { useAction } from "@/hooks/use-action";
import { deleteSafety, saveSafety } from "./actions";

type Topic = { id: string; title: string; category: string | null; content_md: string; is_published: boolean };

export function SafetyDialog({ topic }: { topic?: Topic }) {
  const { run } = useAction();
  return (
    <FormDialog
      trigger={
        topic ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${topic.title}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Topik Baru
          </Button>
        )
      }
      title={topic ? "Edit topik" : "Topik safety baru"}
      description="Isi mendukung Markdown."
      onSubmit={(fd) => run(() => saveSafety(fd))}
      className="sm:max-w-2xl"
    >
      {topic && <input type="hidden" name="id" value={topic.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Judul" htmlFor="sf-title" required>
          <Input id="sf-title" name="title" defaultValue={topic?.title} required />
        </Field>
        <Field label="Kategori" htmlFor="sf-cat">
          <Input id="sf-cat" name="category" defaultValue={topic?.category ?? ""} placeholder="Berkendara / Kebakaran ..." />
        </Field>
      </div>
      <Field label="Isi" htmlFor="sf-body">
        <Textarea id="sf-body" name="content_md" defaultValue={topic?.content_md} rows={12} className="font-mono text-sm" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="is_published" defaultChecked={topic?.is_published ?? true} />
        Tampilkan ke tim
      </label>
    </FormDialog>
  );
}

export function SafetyDelete({ topic }: { topic: Topic }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      destructive
      title={`Hapus "${topic.title}"?`}
      confirmText="Hapus"
      onConfirm={() => run(() => deleteSafety(topic.id))}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Hapus">
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  );
}
