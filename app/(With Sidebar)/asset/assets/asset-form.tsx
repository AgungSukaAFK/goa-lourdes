"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { uploadFile } from "@/lib/upload";
import type { AssetRow, Category } from "@/lib/asset/types";
import { saveAsset } from "./actions";

export type AssetFormOptions = {
  companies: Option[];
  categories: Category[];
  sites: (Option & { company: string })[];
  employees: (Option & { company: string })[];
};

export function AssetFormDialog({
  asset,
  options,
  trigger,
  photoUrl,
}: {
  asset?: AssetRow;
  options: AssetFormOptions;
  trigger: React.ReactNode;
  photoUrl?: string | null;
}) {
  const { run } = useAction();
  const [company, setCompany] = useState<string>(asset?.company ?? options.companies[0]?.value ?? "GMI");
  const [categoryId, setCategoryId] = useState(asset?.category_id ?? "");
  const [siteId, setSiteId] = useState(asset?.site_id ?? "");
  const [ownerId, setOwnerId] = useState(asset?.owner_employee_id ?? "");
  const [dep, setDep] = useState(String(asset?.depreciation_years ?? 4));
  const [photo, setPhoto] = useState<{ path: string | null; preview: string | null }>({
    path: asset?.photo_path ?? null,
    preview: photoUrl ?? null,
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const forCompany = <T extends { company: string }>(list: T[]) =>
    list.filter((x) => x.company === company || x.company === "LOURDES");

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile("asset-photos", `${company}/${asset?.id ?? "new"}`, file);
      setPhoto({ path, preview: URL.createObjectURL(file) });
    } catch {
      toast.error("Upload foto gagal.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormDialog
      trigger={trigger}
      title={asset ? `Edit ${asset.code}` : "Registrasi aset"}
      description={asset ? undefined : "Kode aset dibuat otomatis sesuai format PT, kecuali diisi manual."}
      onSubmit={(fd) => run(() => saveAsset(fd))}
      className="sm:max-w-3xl"
    >
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="owner_employee_id" value={ownerId} />
      <input type="hidden" name="photo_path" value={photo.path ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama aset" htmlFor="as-name" required className="sm:col-span-2">
          <Input id="as-name" name="name" defaultValue={asset?.name} required maxLength={150} />
        </Field>
        <Field label="PT" required>
          <OptionSelect
            value={company}
            onValueChange={(v) => {
              setCompany(v);
              setSiteId("");
              setOwnerId("");
            }}
            options={options.companies}
            disabled={!!asset}
          />
        </Field>
        <Field label="Kategori">
          <OptionSelect
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              const c = options.categories.find((x) => x.id === v);
              if (c) setDep(String(c.depreciation_years));
            }}
            options={options.categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Pilih kategori"
          />
        </Field>
        <Field label="Site">
          <OptionSelect value={siteId} onValueChange={setSiteId} options={forCompany(options.sites)} placeholder="Pilih site" />
        </Field>
        <Field label="Pemegang (PIC)">
          <OptionSelect
            value={ownerId}
            onValueChange={setOwnerId}
            options={[{ value: "", label: "Belum ada", company }, ...forCompany(options.employees)]}
            placeholder="Pilih karyawan"
          />
        </Field>
        <Field label="Merek" htmlFor="as-brand">
          <Input id="as-brand" name="brand" defaultValue={asset?.brand ?? ""} />
        </Field>
        <Field label="Model / tipe" htmlFor="as-model">
          <Input id="as-model" name="model" defaultValue={asset?.model ?? ""} />
        </Field>
        <Field label="Serial number" htmlFor="as-sn">
          <Input id="as-sn" name="serial_number" defaultValue={asset?.serial_number ?? ""} />
        </Field>
        <Field label="Tanggal pembelian" htmlFor="as-date">
          <Input id="as-date" name="purchase_date" type="date" defaultValue={asset?.purchase_date ?? ""} />
        </Field>
        <Field label="Harga perolehan (Rp)" htmlFor="as-cost">
          <Input id="as-cost" name="cost" type="number" min={0} step="1" defaultValue={asset?.cost ?? 0} />
        </Field>
        <Field label="Masa penyusutan (tahun)" htmlFor="as-dep">
          <Input id="as-dep" name="depreciation_years" type="number" min={0} max={50} value={dep} onChange={(e) => setDep(e.target.value)} />
        </Field>
        <Field label="Kode Accurate" htmlFor="as-acc">
          <Input id="as-acc" name="accurate_code" defaultValue={asset?.accurate_code ?? ""} />
        </Field>
        <Field label="Kode aset" htmlFor="as-code" hint={asset ? "Ubah hanya kalau perlu menyamakan label lama." : "Kosongkan untuk dibuat otomatis."}>
          <Input id="as-code" name="code" defaultValue={asset?.code ?? ""} className="font-mono" />
        </Field>
        <Field label="Nomor MR" htmlFor="as-mr">
          <Input id="as-mr" name="mr_number" defaultValue={asset?.mr_number ?? ""} />
        </Field>
        <Field label="Nomor PO" htmlFor="as-po">
          <Input id="as-po" name="po_number" defaultValue={asset?.po_number ?? ""} />
        </Field>
        <Field label="Catatan" htmlFor="as-notes" className="sm:col-span-2">
          <Textarea id="as-notes" name="notes" defaultValue={asset?.notes ?? ""} rows={2} maxLength={1000} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_borrowable" defaultChecked={asset?.is_borrowable ?? false} />
          Dapat dipinjam karyawan lain
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {photo.preview && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="Foto aset" className="size-12 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => setPhoto({ path: null, preview: null })}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                aria-label="Hapus foto"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
            {photo.preview ? "Ganti foto" : "Foto aset"}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
