"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  vehicle_id: z.string().uuid("Pilih kendaraan."),
  driver_id: z.string().uuid().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal."),
  start_odo: z.coerce.number().int().min(0),
  end_odo: z.coerce.number().int().min(1, "Isi KM akhir."),
  liters: z.coerce.number().positive("Isi jumlah liter."),
  total_cost: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional(),
});

export async function saveFuel(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("fleet", ["admin", "driver"]);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.end_odo <= d.start_odo) return fail("KM akhir harus lebih besar dari KM awal.");
  if ((d.end_odo - d.start_odo) / d.liters > 40) return fail("Rasio > 40 km/L tidak wajar. Periksa KM atau liter.");
  const supabase = await createClient();
  const { data: v } = await supabase.from("fleet_vehicles").select("company").eq("id", d.vehicle_id).single();
  if (!v) return fail("Kendaraan tidak ditemukan.");
  let driver = d.driver_id || null;
  if (session.role === "driver") {
    const { data: mine } = await supabase.rpc("fleet_my_driver_id");
    driver = mine as string | null;
  }
  const { error } = await supabase.from("fleet_fuel_logs").insert({
    company: v.company,
    vehicle_id: d.vehicle_id,
    driver_id: driver,
    date: d.date,
    start_odo: d.start_odo,
    end_odo: d.end_odo,
    liters: d.liters,
    total_cost: d.total_cost,
    notes: d.notes || null,
    created_by: session.userId,
  });
  if (error) return fail(dbError(error));
  await supabase.rpc("fleet_log_odometer", { p_vehicle: d.vehicle_id, p_odo: d.end_odo, p_source: "fuel" });
  revalidatePath("/fleet", "layout");
  const ratio = (d.end_odo - d.start_odo) / d.liters;
  return ok(`Tersimpan · ${ratio.toFixed(1)} km/L.`);
}

export async function deleteFuel(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error, count } = await supabase.from("fleet_fuel_logs").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Data tidak ditemukan.");
  revalidatePath("/fleet/fuel");
  return ok("Data BBM dihapus.");
}
