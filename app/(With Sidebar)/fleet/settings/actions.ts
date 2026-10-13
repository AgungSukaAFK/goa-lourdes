"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const done = (msg: string) => {
  revalidatePath("/fleet", "layout");
  return ok(msg);
};

export async function savePart(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      id: z.string().uuid().optional().or(z.literal("")),
      name: z.string().trim().min(2).max(80),
      type: z.enum(["km", "days"]),
      interval: z.coerce.number().int().positive("Interval harus > 0."),
      cost: z.coerce.number().min(0),
      date_source: z.enum(["tax_date", "kir_date", "plate_date", ""]).optional(),
      vehicle_ids: z.string().default(""),
      is_active: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, vehicle_ids, is_active, date_source, ...d } = p.data;
  const ids = vehicle_ids.split(",").filter(Boolean);
  const row = { ...d, vehicle_ids: ids.length ? ids : null, date_source: d.type === "days" && date_source ? date_source : null, is_active: is_active === "on" };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("fleet_parts").update(row).eq("id", id) : await supabase.from("fleet_parts").insert(row);
  if (error) return fail(dbError(error));
  return done("Part disimpan.");
}

export async function deletePart(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("fleet_parts").delete().eq("id", id);
  if (error) return fail(dbError(error));
  return done("Part dihapus.");
}

export async function saveP2hItem(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      id: z.string().uuid().optional().or(z.literal("")),
      target: z.enum(["vehicle", "driver"]),
      category: z.string().trim().min(2).max(60),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(300).optional(),
      weight: z.coerce.number().int().min(0).max(100),
      sort: z.coerce.number().int().default(0),
      is_critical: z.enum(["on"]).optional(),
      is_active: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, is_critical, is_active, ...d } = p.data;
  const row = { ...d, description: d.description || null, is_critical: is_critical === "on", is_active: is_active === "on" };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("fleet_p2h_items").update(row).eq("id", id) : await supabase.from("fleet_p2h_items").insert(row);
  if (error) return fail(dbError(error));
  return done("Item checklist disimpan.");
}

export async function saveInspector(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail("Isi nama pemeriksa.");
  const supabase = await createClient();
  const { error } = await supabase.from("fleet_inspectors").insert({ name: p.data.name });
  if (error) return fail(dbError(error));
  return done("Pemeriksa ditambahkan.");
}

export async function deleteInspector(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("fleet_inspectors").delete().eq("id", id);
  if (error) return fail(dbError(error));
  return done("Pemeriksa dihapus.");
}

export async function saveCost(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      fuelPrice: z.coerce.number().positive(),
      kmPerLiter: z.coerce.number().positive(),
      tollPerKm: z.coerce.number().min(0),
      poolLat: z.coerce.number().min(-90).max(90),
      poolLng: z.coerce.number().min(-180).max(180),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail("Periksa kembali angka yang diisi.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "fleet_cost", company: "LOURDES", value: p.data, updated_by: session.userId, updated_at: new Date().toISOString() });
  if (error) return fail(dbError(error, "Gagal menyimpan. Pengaturan ini butuh hak admin."));
  return done("Parameter biaya disimpan.");
}
