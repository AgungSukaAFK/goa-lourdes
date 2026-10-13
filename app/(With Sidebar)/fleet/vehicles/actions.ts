"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { parseCompany } from "@/lib/company-parse";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  plate: z.string().trim().min(3, "Isi nomor polisi.").max(20),
  model: z.string().trim().min(2, "Isi model kendaraan.").max(80),
  brand: z.string().trim().max(60).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional().or(z.literal("")),
  company: z.enum(["GMI", "GIS"], { message: "Pilih PT." }),
  site_id: z.string().uuid().optional().or(z.literal("")),
  odometer: z.coerce.number().int().min(0),
  service_interval_km: z.coerce.number().int().min(500).max(100000),
  last_service_odo: z.coerce.number().int().min(0),
  tax_date: date,
  kir_date: date,
  plate_date: date,
  status: z.enum(["available", "maintenance", "inactive", "grounded", "in_use"]),
  notes: z.string().trim().max(1000).optional(),
  photo_path: z.string().max(300).optional(),
});

const n = (v?: string | number) => (v === "" || v === undefined ? null : v);
const normPlate = (p: string) => p.toUpperCase().replace(/\s+/g, " ").trim();

export async function saveVehicle(fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireModule("fleet", ["admin"]);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, ...d } = p.data;
  const row = {
    ...d,
    plate: normPlate(d.plate),
    brand: n(d.brand),
    year: n(d.year),
    site_id: n(d.site_id),
    tax_date: n(d.tax_date),
    kir_date: n(d.kir_date),
    plate_date: n(d.plate_date),
    notes: n(d.notes),
    photo_path: n(d.photo_path),
  };
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("fleet_vehicles").select("odometer").eq("id", id).single();
    const { error } = await supabase.from("fleet_vehicles").update(row).eq("id", id);
    if (error) return fail(error.code === "23505" ? `Plat ${row.plate} sudah terdaftar.` : dbError(error));
    if (before && row.odometer !== before.odometer) {
      await supabase.from("fleet_odometer_logs").insert({ vehicle_id: id, odometer: row.odometer, source: "manual" });
    }
    revalidatePath(`/fleet/vehicles/${id}`);
    return ok("Kendaraan diperbarui.", { id });
  }
  const { data, error } = await supabase.from("fleet_vehicles").insert(row).select("id").single();
  if (error) return fail(error.code === "23505" ? `Plat ${row.plate} sudah terdaftar.` : dbError(error));
  await supabase.from("fleet_odometer_logs").insert({ vehicle_id: data.id, odometer: row.odometer, source: "manual" });
  return ok("Kendaraan ditambahkan.", { id: data.id });
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error, count } = await supabase.from("fleet_vehicles").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error, "Gagal menghapus. Kendaraan masih punya booking; ubah status jadi Nonaktif saja."));
  if (!count) return fail("Kendaraan tidak ditemukan.");
  return ok("Kendaraan dihapus.");
}

export async function recordService(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("fleet", ["admin"]);
  const p = z
    .object({
      vehicle_id: z.string().uuid(),
      part_id: z.string().uuid().optional().or(z.literal("")),
      odometer: z.coerce.number().int().min(0),
      serviced_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cost: z.coerce.number().min(0).default(0),
      notes: z.string().trim().max(500).optional(),
      general: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("fleet_service_logs").insert({
    vehicle_id: d.vehicle_id,
    part_id: d.part_id || null,
    odometer: d.odometer,
    serviced_at: d.serviced_at,
    cost: d.cost,
    notes: d.notes || null,
    created_by: session.userId,
  });
  if (error) return fail(dbError(error));
  // Servis berkala umum -> reset hitungan interval servis kendaraan.
  if (d.general === "on" || !d.part_id) {
    await supabase.from("fleet_vehicles").update({ last_service_odo: d.odometer }).eq("id", d.vehicle_id);
  }
  await supabase.rpc("fleet_log_odometer", { p_vehicle: d.vehicle_id, p_odo: d.odometer, p_source: "service" });
  revalidatePath(`/fleet/vehicles/${d.vehicle_id}`);
  return ok("Riwayat servis dicatat.");
}

export async function importVehicles(rows: Record<string, string>[]): Promise<ActionResult<{ errors?: string[] }>> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, name, company");
  const siteMap = new Map((sites ?? []).map((s) => [`${s.company}|${s.name.toLowerCase()}`, s.id as string]));
  const errors: string[] = [];
  const valid = [];
  const d = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
  for (const [i, r] of rows.entries()) {
    const plate = normPlate(r["Plat"] ?? "");
    const company = parseCompany(r["PT"]);
    if (!plate || !r["Model"]) {
      errors.push(`Baris ${i + 2}: Plat & Model wajib.`);
      continue;
    }
    if (company !== "GMI" && company !== "GIS") {
      errors.push(`Baris ${i + 2}: PT harus GMI atau GIS.`);
      continue;
    }
    const site = (r["Site"] ?? "").toLowerCase();
    valid.push({
      plate,
      model: r["Model"].trim(),
      brand: r["Merek"] || null,
      year: Number(r["Tahun"]) || null,
      company,
      site_id: siteMap.get(`${company}|${site}`) ?? siteMap.get(`LOURDES|${site}`) ?? null,
      odometer: Number(String(r["KM"] ?? "0").replace(/\D/g, "")) || 0,
      service_interval_km: Number(r["Interval Servis (KM)"]) || 5000,
      last_service_odo: Number(String(r["KM Servis Terakhir"] ?? "0").replace(/\D/g, "")) || 0,
      tax_date: d(r["Jatuh Tempo Pajak"]),
      kir_date: d(r["Jatuh Tempo KIR"]),
      plate_date: d(r["Jatuh Tempo Plat (5 Th)"]),
    });
  }
  const { error } = valid.length ? await supabase.from("fleet_vehicles").upsert(valid, { onConflict: "plate" }) : { error: null };
  if (error) return fail(dbError(error));
  return ok(`${valid.length} kendaraan tersimpan${errors.length ? `, ${errors.length} dilewati` : ""}.`, { errors });
}
