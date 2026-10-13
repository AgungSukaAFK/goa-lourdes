"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

export async function reportRepair(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("fleet", ["admin", "driver"]);
  const p = z
    .object({
      vehicle_id: z.string().uuid("Pilih kendaraan."),
      component: z.string().trim().min(2, "Isi komponen.").max(120),
      description: z.string().trim().max(1000).optional(),
      is_critical: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { data: v } = await supabase.from("fleet_vehicles").select("company").eq("id", p.data.vehicle_id).single();
  if (!v) return fail("Kendaraan tidak ditemukan.");
  const { data: code } = await supabase.rpc("next_doc_code", { p_prefix: "REP" });
  const { error } = await supabase.from("fleet_repairs").insert({
    code,
    company: v.company,
    vehicle_id: p.data.vehicle_id,
    component: p.data.component,
    description: p.data.description || null,
    is_critical: p.data.is_critical === "on",
    reported_by: session.userId,
    reported_by_name: session.profile.name,
  });
  if (error) return fail(dbError(error));
  if (p.data.is_critical === "on" && session.role === "admin") {
    await supabase.from("fleet_vehicles").update({ status: "grounded" }).eq("id", p.data.vehicle_id).eq("status", "available");
  }
  revalidatePath("/fleet", "layout");
  return ok(`Laporan ${code} masuk antrean perbaikan.`);
}

export async function startRepair(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      id: z.string().uuid(),
      mechanic: z.string().trim().max(120).optional(),
      workshop: z.string().trim().max(120).optional(),
      estimated_cost: z.coerce.number().min(0).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase
    .from("fleet_repairs")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      mechanic: p.data.mechanic || null,
      workshop: p.data.workshop || null,
      estimated_cost: p.data.estimated_cost ?? null,
    })
    .eq("id", p.data.id)
    .eq("status", "queued");
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok("Perbaikan mulai dikerjakan.");
}

export async function completeRepair(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      id: z.string().uuid(),
      actual_cost: z.coerce.number().min(0, "Biaya tidak boleh negatif."),
      mechanic: z.string().trim().min(1, "Isi nama mekanik / bengkel.").max(120),
      workshop: z.string().trim().max(120).optional(),
      part_id: z.string().uuid().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fleet_complete_repair", {
    p_repair: p.data.id,
    p_cost: p.data.actual_cost,
    p_mechanic: p.data.mechanic,
    p_workshop: p.data.workshop || null,
    p_part: p.data.part_id || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok("Perbaikan selesai dicatat.");
}

export async function cancelRepair(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { data: r } = await supabase.from("fleet_repairs").update({ status: "cancelled" }).eq("id", id).in("status", ["queued", "in_progress"]).select("vehicle_id").maybeSingle();
  if (!r) return fail("Perbaikan tidak bisa dibatalkan.");
  const { count } = await supabase.from("fleet_repairs").select("id", { count: "exact", head: true }).eq("vehicle_id", r.vehicle_id).in("status", ["queued", "in_progress"]).eq("is_critical", true);
  if (!count) await supabase.from("fleet_vehicles").update({ status: "available" }).eq("id", r.vehicle_id).eq("status", "grounded");
  revalidatePath("/fleet", "layout");
  return ok("Perbaikan dibatalkan.");
}
