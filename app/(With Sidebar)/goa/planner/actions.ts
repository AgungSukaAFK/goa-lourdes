"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  job_category: z.string().trim().max(60).optional(),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  reviewer_id: z.string().uuid().optional().or(z.literal("")),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  days: z.string().default(""),
  due_time: z.string().regex(/^\d{2}:\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  company: z.enum(["GMI", "GIS", "LOURDES"]),
  skip_holidays: z.enum(["on"]).optional(),
  is_active: z.enum(["on"]).optional(),
});

export async function saveTemplate(fd: FormData): Promise<ActionResult> {
  const s = await requireModule("goa", ["supervisor"]);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, days, skip_holidays, is_active, ...d } = p.data;
  const dayList = days.split(",").filter(Boolean).map(Number).filter((n) => Number.isInteger(n));
  if (d.frequency !== "daily" && !dayList.length) return fail("Pilih minimal satu hari.");
  if (d.start_time && d.start_time > d.due_time) return fail("Jam mulai harus sebelum batas jam.");
  const row = {
    ...d,
    description: d.description || null,
    job_category: d.job_category || null,
    assignee_id: d.assignee_id || null,
    reviewer_id: d.reviewer_id || null,
    start_time: d.start_time || null,
    days: d.frequency === "daily" ? [] : dayList,
    skip_holidays: skip_holidays === "on",
    is_active: is_active === "on",
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("goa_task_templates").update(row).eq("id", id)
    : await supabase.from("goa_task_templates").insert({ ...row, created_by: s.userId });
  if (error) return fail(dbError(error));
  revalidatePath("/goa/planner");
  return ok("Template disimpan. Tugas dibuat otomatis tiap hari pukul 00.05 WIB.");
}

export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("goa_task_templates").update({ is_active: active }).eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/goa/planner");
  return ok(active ? "Template diaktifkan." : "Template diblokir (tidak membuat tugas baru).");
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("goa_task_templates").delete().eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/goa/planner");
  return ok("Template dihapus. Tugas yang sudah dibuat tetap ada.");
}

export async function runToday(): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("goa_generate_routine_tasks", { p_date: null });
  if (error) return fail(dbError(error));
  revalidatePath("/goa", "layout");
  return ok(data ? `${data} tugas rutin dibuat untuk hari ini.` : "Tidak ada tugas baru (sudah dibuat / bukan jadwalnya).");
}
