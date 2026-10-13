"use client";

import { useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { getLocalDateString } from "@/lib/utils";
import { decideLoan, requestLoan, returnLoan } from "../loans/actions";
import { decideMutation, requestMutation } from "../mutations/actions";

export type AssetPick = Option & {
  company: string;
  status: string;
  is_borrowable: boolean;
  owner_employee_id: string | null;
};
export type CompanyOption = Option & { company: string };

const forCompany = <T extends { company: string }>(list: T[], company?: string) =>
  company ? list.filter((x) => x.company === company || x.company === "LOURDES") : list;

export function LoanRequestDialog({
  assets,
  employees,
  isAdmin,
  defaultAssetId,
  trigger,
}: {
  assets: AssetPick[];
  employees: CompanyOption[];
  isAdmin: boolean;
  defaultAssetId?: string;
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [borrower, setBorrower] = useState("");
  const available = assets.filter((a) => a.is_borrowable && a.status === "ready");
  const asset = assets.find((a) => a.value === assetId);
  const today = getLocalDateString();

  return (
    <FormDialog trigger={trigger} title="Ajukan peminjaman" onSubmit={(fd) => run(() => requestLoan(fd))}>
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="borrower_employee_id" value={borrower} />
      <Field label="Aset" required hint={available.length ? undefined : "Tidak ada aset READY yang bisa dipinjam."}>
        <OptionSelect value={assetId} onValueChange={setAssetId} options={available} placeholder="Pilih aset yang bisa dipinjam" />
      </Field>
      <Field label="Peminjam" required>
        <OptionSelect value={borrower} onValueChange={setBorrower} options={forCompany(employees, asset?.company)} placeholder="Pilih karyawan" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal pinjam" htmlFor="ln-from" required>
          <Input id="ln-from" name="borrow_date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Rencana kembali" htmlFor="ln-to" required>
          <Input id="ln-to" name="expected_return_date" type="date" min={today} required />
        </Field>
      </div>
      <Field label="Tujuan penggunaan" htmlFor="ln-purpose" required>
        <Textarea id="ln-purpose" name="purpose" rows={2} required maxLength={500} />
      </Field>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="approve_now" />
          Langsung setujui (aset diserahkan sekarang)
        </label>
      )}
    </FormDialog>
  );
}

export function MutationRequestDialog({
  assets,
  employees,
  sites,
  isAdmin,
  defaultAssetId,
  trigger,
}: {
  assets: AssetPick[];
  employees: CompanyOption[];
  sites: CompanyOption[];
  isAdmin: boolean;
  defaultAssetId?: string;
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [to, setTo] = useState("");
  const [site, setSite] = useState("");
  const asset = assets.find((a) => a.value === assetId);
  const movable = assets.filter((a) => a.status !== "loaned" && a.status !== "disposed");

  return (
    <FormDialog
      trigger={trigger}
      title="Mutasi aset"
      description="Pemegang & lokasi aset berubah setelah disetujui GA."
      onSubmit={(fd) => run(() => requestMutation(fd))}
    >
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="to_employee_id" value={to} />
      <input type="hidden" name="to_site_id" value={site} />
      <Field label="Aset" required>
        <OptionSelect value={assetId} onValueChange={setAssetId} options={movable} placeholder="Pilih aset" />
      </Field>
      <Field label="Karyawan penerima" required>
        <OptionSelect
          value={to}
          onValueChange={setTo}
          options={forCompany(employees, asset?.company).filter((e) => e.value !== asset?.owner_employee_id)}
          placeholder="Pilih penerima"
        />
      </Field>
      <Field label="Site tujuan" hint="Kosong = ikut site karyawan penerima.">
        <OptionSelect value={site} onValueChange={setSite} options={[{ value: "", label: "Ikut site penerima", company: "" }, ...forCompany(sites, asset?.company)]} />
      </Field>
      <Field label="Alasan" htmlFor="mt-reason" required>
        <Textarea id="mt-reason" name="reason" rows={2} required maxLength={500} />
      </Field>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="direct" />
          Mutasi langsung (tanpa menunggu persetujuan)
        </label>
      )}
    </FormDialog>
  );
}

/** Setujui / tolak (dengan catatan opsional) untuk pinjam & mutasi. */
export function DecisionButtons({ kind, id, code }: { kind: "loan" | "mutation"; id: string; code: string }) {
  const { run } = useAction();
  const decide = kind === "loan" ? decideLoan : decideMutation;
  return (
    <div className="flex justify-end gap-1">
      <FormDialog
        trigger={
          <Button size="sm">
            <Check />
            Setujui
          </Button>
        }
        title={`Setujui ${code}?`}
        description={kind === "loan" ? "Status aset menjadi Dipinjam." : "Pemegang & site aset langsung berubah."}
        submitText="Setujui"
        onSubmit={(fd) => run(() => decide(id, true, String(fd.get("note") ?? "")))}
      >
        <Field label="Catatan (opsional)" htmlFor={`note-a-${id}`}>
          <Textarea id={`note-a-${id}`} name="note" rows={2} maxLength={300} />
        </Field>
      </FormDialog>
      <FormDialog
        trigger={
          <Button size="sm" variant="outline">
            <X />
            Tolak
          </Button>
        }
        title={`Tolak ${code}?`}
        submitText="Tolak"
        onSubmit={(fd) => run(() => decide(id, false, String(fd.get("note") ?? "")))}
      >
        <Field label="Alasan penolakan" htmlFor={`note-r-${id}`} required>
          <Textarea id={`note-r-${id}`} name="note" rows={2} required maxLength={300} />
        </Field>
      </FormDialog>
    </div>
  );
}

export function ReturnLoanDialog({ id, code }: { id: string; code: string }) {
  const { run } = useAction();
  const [condition, setCondition] = useState<"ready" | "damaged" | "lost">("ready");
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Undo2 />
          Kembalikan
        </Button>
      }
      title={`Pengembalian ${code}`}
      submitText="Catat pengembalian"
      onSubmit={(fd) => run(() => returnLoan(id, condition, String(fd.get("note") ?? "")))}
    >
      <Field label="Kondisi saat kembali" required>
        <OptionSelect
          value={condition}
          onValueChange={(v) => setCondition(v as typeof condition)}
          options={[
            { value: "ready", label: "Baik (Ready)" },
            { value: "damaged", label: "Rusak" },
            { value: "lost", label: "Hilang" },
          ]}
        />
      </Field>
      <Field label="Catatan" htmlFor={`ret-${id}`}>
        <Textarea id={`ret-${id}`} name="note" rows={2} maxLength={300} />
      </Field>
    </FormDialog>
  );
}
