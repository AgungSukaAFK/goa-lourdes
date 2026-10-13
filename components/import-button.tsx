"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadTemplate, readExcel } from "@/lib/excel";
import type { ActionResult } from "@/lib/actions/result";
import { useRouter } from "next/navigation";

/**
 * Import Excel: unduh template -> pilih file -> kirim baris ke server action.
 * Server action mengembalikan ringkasan (berhasil / dilewati) di `message`.
 */
export function ImportButton({
  title,
  description,
  templateName,
  headers,
  example,
  onImport,
}: {
  title: string;
  description?: string;
  templateName: string;
  headers: string[];
  example?: (string | number)[];
  onImport: (rows: Record<string, string>[]) => Promise<ActionResult<{ errors?: string[] }>>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const submit = async () => {
    if (!file) return toast.warning("Pilih file Excel dulu.");
    setBusy(true);
    setErrors([]);
    try {
      const rows = await readExcel(file);
      if (!rows.length) {
        toast.warning("File kosong atau header tidak sesuai template.");
        return;
      }
      const res = await onImport(rows);
      if (res.ok) {
        toast.success(res.message ?? "Import selesai.");
        router.refresh();
        if (res.data?.errors?.length) setErrors(res.data.errors);
        else setOpen(false);
      } else toast.error(res.error);
    } catch {
      toast.error("File tidak bisa dibaca. Pastikan format .xlsx.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        setOpen(o);
        if (!o) {
          setFile(null);
          setErrors([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(templateName, headers, example)}
          >
            <FileSpreadsheet />
            Unduh template
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 text-xs dark:bg-muted/10">
              <p className="mb-1 font-medium">Baris yang dilewati:</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Tutup
          </Button>
          <Button onClick={submit} disabled={busy || !file}>
            {busy && <Loader2 className="animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
