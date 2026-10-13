"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { GOA_PRESENCE, GOA_SP } from "@/lib/status";
import type { TeamMember } from "@/lib/goa/types";
import { saveMember } from "./actions";

export function MemberDialog({ member, members }: { member: TeamMember; members: Option[] }) {
  const { run } = useAction();
  const [sp, setSp] = useState<string>(member.sp_level);
  const [presence, setPresence] = useState(member.presence_status);
  const [backup, setBackup] = useState(member.backup_profile_id ?? "");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Edit ${member.name}`}>
          <Pencil />
        </Button>
      }
      title={`Data tim: ${member.name}`}
      description="Penalti KPI: SP1 −5, SP2 −10, SP3 −20, berlaku 6 bulan dari tanggal terbit."
      onSubmit={(fd) => run(() => saveMember(fd))}
    >
      <input type="hidden" name="profile_id" value={member.id} />
      <input type="hidden" name="sp_level" value={sp} />
      <input type="hidden" name="presence_status" value={presence} />
      <input type="hidden" name="backup_profile_id" value={backup} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jabatan di tim" htmlFor="m-title">
          <Input id="m-title" name="title" defaultValue={member.title ?? ""} placeholder="Driver / Office Boy / Leader ..." />
        </Field>
        <Field label="Kehadiran hari ini">
          <OptionSelect value={presence} onValueChange={setPresence} options={Object.entries(GOA_PRESENCE).map(([value, d]) => ({ value, label: d.label }))} />
        </Field>
        <Field label="Backup PIC" hint="Pengganti saat cuti/sakit.">
          <OptionSelect value={backup} onValueChange={setBackup} options={[{ value: "", label: "-" }, ...members.filter((m) => m.value !== member.id)]} />
        </Field>
        <div />
        <Field label="Surat Peringatan">
          <OptionSelect value={sp} onValueChange={setSp} options={Object.entries(GOA_SP).map(([value, d]) => ({ value, label: d.label }))} />
        </Field>
        {sp !== "none" && (
          <Field label="Tanggal terbit SP" htmlFor="m-spdate" required>
            <Input id="m-spdate" name="sp_date" type="date" defaultValue={member.sp_date ?? ""} required />
          </Field>
        )}
      </div>
    </FormDialog>
  );
}
