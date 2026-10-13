"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FormDialog } from "@/components/form-dialog";
import { useAction } from "@/hooks/use-action";
import type { Category } from "@/lib/asset/types";
import { deleteCategory, saveCategory } from "./actions";

export function CategoryFormDialog({ category, trigger }: { category?: Category; trigger?: React.ReactNode }) {
  const { run } = useAction();
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button>
            <Plus />
            Tambah Kategori
          </Button>
        )
      }
      title={category ? "Edit kategori" : "Tambah kategori"}
      onSubmit={(fd) => run(() => saveCategory(fd))}
    >
      {category && <input type="hidden" name="id" value={category.id} />}
      <Field label="Nama kategori" htmlFor="cat-name" required>
        <Input id="cat-name" name="name" defaultValue={category?.name} required maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode singkat" htmlFor="cat-code" hint="Untuk {CAT} di kode aset. Kosong = 3 huruf nama.">
          <Input id="cat-code" name="code" defaultValue={category?.code ?? ""} maxLength={5} className="uppercase" />
        </Field>
        <Field label="Masa penyusutan (tahun)" htmlFor="cat-dep" required>
          <Input id="cat-dep" name="depreciation_years" type="number" min={0} max={50} defaultValue={category?.depreciation_years ?? 4} required />
        </Field>
      </div>
    </FormDialog>
  );
}

export function CategoryRowActions({ category, canDelete }: { category: Category; canDelete: boolean }) {
  const { run } = useAction();
  return (
    <div className="flex justify-end gap-1">
      <CategoryFormDialog
        category={category}
        trigger={
          <Button variant="ghost" size="sm" aria-label={`Edit ${category.name}`} title="Edit">
            <Pencil />
          </Button>
        }
      />
      {canDelete && (
        <ConfirmButton
          destructive
          title={`Hapus kategori ${category.name}?`}
          description="Aset di kategori ini akan kehilangan kategorinya."
          confirmText="Hapus"
          onConfirm={() => run(() => deleteCategory(category.id))}
          trigger={
            <Button variant="ghost" size="sm" aria-label={`Hapus ${category.name}`} title="Hapus">
              <Trash2 className="text-destructive" />
            </Button>
          }
        />
      )}
    </div>
  );
}
