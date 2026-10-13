"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const done = (msg: string) => {
  revalidatePath("/goa", "layout");
  return ok(msg);
};

const taskSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  description: z.string().trim().max(2000).optional(),
  job_category: z.string().trim().max(60).optional(),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  reviewer_id: z.string().uuid().optional().or(z.literal("")),
  due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional().or(z.literal("")),
  company: z.enum(["GMI", "GIS", "LOURDES"]).optional(),
});

export async function saveTask(fd: FormData): Promise<ActionResult> {
  const s = await requireModule("goa", ["supervisor", "member"]);
  const p = taskSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();
  const row = {
    title: d.title,
    description: d.description || null,
    job_category: d.job_category || null,
    assignee_id: d.assignee_id || null,
    reviewer_id: d.reviewer_id || null,
    due_at: d.due_at ? `${d.due_at}:00+07:00` : null,
  };
  if (d.id) {
    const { error, count } = await supabase.from("goa_tasks").update(row, { count: "exact" }).eq("id", d.id);
    if (error) return fail(dbError(error));
    if (!count) return fail("Hanya atasan yang bisa mengubah tugas.");
    return done("Tugas diperbarui.");
  }
  if (s.role === "member" && row.assignee_id && row.assignee_id !== s.userId) {
    return fail("Anggota hanya bisa membuat tugas untuk dirinya sendiri atau General Pool.");
  }
  const company = d.company ?? s.profile.company ?? "LOURDES";
  const { data: code } = await supabase.rpc("next_doc_code", { p_prefix: "TSK" });
  const { error } = await supabase.from("goa_tasks").insert({ ...row, code, company, created_by: s.userId });
  if (error) return fail(dbError(error));
  return done(`Tugas ${code} dibuat.`);
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireModule("goa");
  const supabase = await createClient();
  const { error, count } = await supabase.from("goa_tasks").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Tugas tidak bisa dihapus (bukan milik Anda atau sudah dikerjakan).");
  return done("Tugas dihapus.");
}

export async function startTask(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor", "member"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_start_task", { p_task: id });
  if (error) return fail(dbError(error));
  return done("Tugas mulai dikerjakan.");
}

export async function finishTask(id: string, isDone: boolean, note: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor", "member"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_finish_task", { p_task: id, p_done: isDone, p_note: note || null });
  if (error) return fail(dbError(error));
  return done(isDone ? "Tugas selesai." : "Tugas ditutup tidak selesai.");
}

export async function rateTask(id: string, rating: number): Promise<ActionResult> {
  await requireModule("goa");
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_rate_task", { p_task: id, p_rating: rating });
  if (error) return fail(dbError(error));
  return done(`Dinilai ${rating}/5.`);
}

export async function reopenTask(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_reopen_task", { p_task: id });
  if (error) return fail(dbError(error));
  return done("Tugas dibuka kembali.");
}

export async function exportTasks(params: Record<string, string>): Promise<ActionResult<Record<string, unknown>[]>> {
  await requireModule("goa");
  const supabase = await createClient();
  let q = supabase.from("goa_tasks_view").select("*").order("created_at", { ascending: false }).limit(10000);
  if (params.status) q = q.eq("status", params.status);
  if (params.member === "pool") q = q.is("assignee_id", null);
  else if (params.member) q = q.eq("assignee_id", params.member);
  if (params.category) q = q.eq("job_category", params.category);
  if (params.from) q = q.gte("created_at", `${params.from}T00:00:00+07:00`);
  if (params.to) q = q.lte("created_at", `${params.to}T23:59:59+07:00`);
  const { data, error } = await q;
  if (error) return fail(dbError(error));
  return ok(undefined, data as Record<string, unknown>[]);
}
