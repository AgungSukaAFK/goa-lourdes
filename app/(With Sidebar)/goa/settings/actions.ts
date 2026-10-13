"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const done = (m: string) => {
  revalidatePath("/goa", "layout");
  return ok(m);
};

const paramSchema = z.array(z.object({ key: z.enum(["speed", "quality", "done_ratio", "active_ratio", "p2h"]), label: z.string().min(1).max(60), weight: z.number().int().min(0).max(10) })).min(1);

export async function saveKpi(target: string, params: unknown): Promise<ActionResult> {
  const s = await requireModule("goa", ["supervisor"]);
  const p = paramSchema.safeParse(params);
  if (!p.success) return fail("Parameter tidak valid.");
  if (!p.data.some((x) => x.weight > 0)) return fail("Minimal satu parameter berbobot > 0.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("goa_kpi_settings")
    .upsert({ target, parameters: p.data, updated_by: s.userId, updated_at: new Date().toISOString() });
  if (error) return fail(dbError(error));
  return done(target === "GLOBAL" ? "Bobot KPI global disimpan." : "Bobot khusus anggota disimpan.");
}

export async function resetKpi(target: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  if (target === "GLOBAL") return fail("Bobot global tidak bisa dihapus.");
  const supabase = await createClient();
  const { error } = await supabase.from("goa_kpi_settings").delete().eq("target", target);
  if (error) return fail(dbError(error));
  return done("Anggota kembali memakai bobot global.");
}

export async function addCategory(name: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const n = name.trim();
  if (n.length < 2) return fail("Nama kategori minimal 2 karakter.");
  const supabase = await createClient();
  const { error } = await supabase.from("goa_categories").insert({ name: n, sort: 50 });
  if (error) return fail(dbError(error));
  return done("Kategori ditambahkan.");
}

export async function deleteCategory(name: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("goa_categories").delete().eq("name", name);
  if (error) return fail(dbError(error));
  return done("Kategori dihapus.");
}

export async function addHoliday(date: string, name: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || name.trim().length < 2) return fail("Isi tanggal & nama hari libur.");
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").upsert({ date, name: name.trim() });
  if (error) return fail(dbError(error));
  return done("Hari libur disimpan.");
}

export async function deleteHoliday(date: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("date", date);
  if (error) return fail(dbError(error));
  return done("Hari libur dihapus.");
}
