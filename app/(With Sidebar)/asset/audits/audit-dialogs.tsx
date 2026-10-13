"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Camera, ClipboardCheck, Loader2, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { uploadFile } from "@/lib/upload";
import { getLocalDateString } from "@/lib/utils";
import { RowDelete } from "../_components/row-delete";
import { createAudits, deleteAudit, realizeAudit } from "./actions";

export function CreateAuditDialog({ assets, sites }: { assets: Option[]; sites: Option[] }) {
  const { run } = useAction();
  const [mode, setMode] = useState<"random" | "selected">("random");
  const [picked, setPicked] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [site, setSite] = useState("");
  const due = getLocalDateString(new Date(Date.now() + 7 * 86400000));

  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Buat Audit
        </Button>
      }
      title="Buat tugas audit"
      description="Petugas memeriksa fisik aset, lalu mengisi kondisi temuan & foto."
      onSubmit={(fd) => run(() => createAudits(fd))}
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="asset_ids" value={picked.join(",")} />
      <input type="hidden" name="site_id" value={site} />
      <Field label="Cara memilih aset">
        <OptionSelect
          value={mode}
          onValueChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: "random", label: "Acak (sampling)" },
            { value: "selected", label: "Pilih aset tertentu" },
          ]}
        />
      </Field>
      {mode === "random" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jumlah aset" htmlFor="aud-count">
            <Input id="aud-count" name="count" type="number" min={1} max={200} defaultValue={5} />
          </Field>
          <Field label="Batasi site">
            <OptionSelect value={site} onValueChange={setSite} options={[{ value: "", label: "Semua site" }, ...sites]} />
          </Field>
        </div>
      ) : (
        <Field label={`Aset (${picked.length} dipilih)`}>
          <OptionSelect
            value={current}
            onValueChange={(v) => {
              if (v && !picked.includes(v)) setPicked([...picked, v]);
              setCurrent("");
            }}
            options={assets.filter((a) => !picked.includes(a.value))}
            placeholder="Tambah aset..."
          />
          {picked.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {picked.map((id) => (
                <li key={id} className="inline-flex h-7 items-center gap-1 rounded-full border bg-background pl-2.5 pr-1 text-xs shadow-xs">
                  {assets.find((a) => a.value === id)?.label}
                  <button
                    type="button"
                    className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    onClick={() => setPicked(picked.filter((x) => x !== id))}
                    aria-label="Hapus"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      )}
      <Field label="Jatuh tempo" htmlFor="aud-due" required>
        <Input id="aud-due" name="due_date" type="date" defaultValue={due} required />
      </Field>
    </FormDialog>
  );
}

export function AuditRowActions({
  id,
  code,
  company,
  assetId,
  status,
  canWrite,
  canDelete,
}: {
  id: string;
  code: string;
  company: string;
  assetId: string;
  status: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { run } = useAction();
  const [condition, setCondition] = useState("ready");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-end gap-1">
      {canWrite && status === "waiting" && (
        <FormDialog
          trigger={
            <Button size="sm">
              <ClipboardCheck />
              Realisasi
            </Button>
          }
          title={`Realisasi ${code}`}
          description="Isi kondisi fisik yang ditemukan. Status aset ikut diperbarui."
          onSubmit={(fd) => run(() => realizeAudit(fd))}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="photo_path" value={photo ?? ""} />
          <Field label="Kondisi ditemukan" required>
            <OptionSelect
              value={condition}
              onValueChange={setCondition}
              options={[
                { value: "ready", label: "Baik (Ready)" },
                { value: "loaned", label: "Sedang dipinjam (sesuai)" },
                { value: "damaged", label: "Rusak" },
                { value: "lost", label: "Tidak ditemukan / hilang" },
              ]}
            />
          </Field>
          <Field label="Catatan temuan" htmlFor={`aud-n-${id}`} required>
            <Textarea id={`aud-n-${id}`} name="notes" rows={3} required maxLength={1000} />
          </Field>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  setPhoto(await uploadFile("audit-photos", `${company}/${assetId}`, f));
                } catch {
                  toast.error("Upload foto gagal.");
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
              {photo ? "Ganti foto" : "Foto bukti"}
            </Button>
            {photo && <span className="text-xs text-muted-foreground">Foto terlampir</span>}
          </div>
        </FormDialog>
      )}
      {status === "fulfilled" && (
        <Button asChild variant="ghost" size="sm" title="Cetak laporan">
          <Link href={`/print/asset-audit/${id}`} target="_blank" aria-label={`Cetak ${code}`}>
            <Printer />
          </Link>
        </Button>
      )}
      {canDelete && <RowDelete label={code} onDelete={() => deleteAudit(id)} />}
    </div>
  );
}
