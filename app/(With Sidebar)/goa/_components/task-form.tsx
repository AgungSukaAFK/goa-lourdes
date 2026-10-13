"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import type { GoaTask } from "@/lib/goa/types";
import { saveTask } from "../actions";

const POOL = "";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TaskFormDialog({
  task,
  members,
  categories,
  companies,
  isSupervisor,
  selfId,
  trigger,
}: {
  task?: GoaTask;
  members: Option[];
  categories: string[];
  companies: Option[];
  isSupervisor: boolean;
  selfId: string;
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [assignee, setAssignee] = useState(task?.assignee_id ?? (isSupervisor ? POOL : selfId));
  const [reviewer, setReviewer] = useState(task?.reviewer_id ?? "");
  const [category, setCategory] = useState(task?.job_category ?? categories[0] ?? "");
  const [company, setCompany] = useState<string>(task?.company ?? companies[0]?.value ?? "");
  const assigneeOpts = isSupervisor
    ? [{ value: POOL, label: "General Pool (siapa saja)" }, ...members]
    : [{ value: POOL, label: "General Pool (siapa saja)" }, ...members.filter((m) => m.value === selfId)];

  return (
    <FormDialog trigger={trigger} title={task ? `Edit ${task.code}` : "Tugas baru"} onSubmit={(fd) => run(() => saveTask(fd))} className="sm:max-w-xl">
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="assignee_id" value={assignee} />
      <input type="hidden" name="reviewer_id" value={reviewer} />
      <input type="hidden" name="job_category" value={category} />
      {!task && companies.length > 1 && <input type="hidden" name="company" value={company} />}
      <Field label="Judul tugas" htmlFor="tk-title" required>
        <Input id="tk-title" name="title" defaultValue={task?.title} required maxLength={200} />
      </Field>
      <Field label="Deskripsi" htmlFor="tk-desc">
        <Textarea id="tk-desc" name="description" defaultValue={task?.description ?? ""} rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PIC">
          <OptionSelect value={assignee} onValueChange={setAssignee} options={assigneeOpts} />
        </Field>
        <Field label="Reviewer">
          <OptionSelect value={reviewer} onValueChange={setReviewer} options={[{ value: "", label: "Atasan mana saja" }, ...members]} />
        </Field>
        <Field label="Kategori">
          <OptionSelect value={category} onValueChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Batas waktu" htmlFor="tk-due">
          <Input id="tk-due" name="due_at" type="datetime-local" defaultValue={toLocalInput(task?.due_at ?? null)} />
        </Field>
        {!task && companies.length > 1 && (
          <Field label="PT">
            <OptionSelect value={company} onValueChange={setCompany} options={companies} />
          </Field>
        )}
      </div>
    </FormDialog>
  );
}
