"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { getCostSettings } from "@/lib/fleet/server";
import { estimateTrip, haversineKm } from "@/lib/fleet/types";

const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Isi tanggal & jam.");
/** "2026-10-14T08:00" (input datetime-local, WIB) -> ISO dengan offset +07:00 */
const wib = (v: string) => `${v}:00+07:00`;

const schema = z.object({
  vehicle_id: z.string().uuid("Pilih kendaraan."),
  requester_employee_id: z.string().uuid("Pilih pemohon."),
  driver_id: z.string().uuid().optional().or(z.literal("")),
  start_time: dt,
  end_time: dt,
  purpose: z.string().trim().min(3, "Isi keperluan.").max(500),
  destination: z.string().trim().min(2, "Isi tujuan.").max(200),
  dest_lat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  dest_lng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
});

export async function createBooking(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireModule("fleet");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.end_time <= d.start_time) return fail("Waktu selesai harus setelah waktu mulai.");

  // Non-admin hanya boleh membooking atas nama dirinya.
  if (session.role !== "admin" && d.requester_employee_id !== session.profile.employee_id) {
    return fail("Booking hanya bisa diajukan atas nama Anda sendiri.");
  }

  const supabase = await createClient();
  const { data: v } = await supabase.from("fleet_vehicles").select("company, status").eq("id", d.vehicle_id).single();
  if (!v) return fail("Kendaraan tidak ditemukan.");
  if (["grounded", "maintenance", "inactive"].includes(v.status)) return fail("Kendaraan sedang tidak bisa dipakai.");

  const start = wib(d.start_time);
  const end = wib(d.end_time);
  const { data: clash } = await supabase
    .from("fleet_bookings")
    .select("code")
    .eq("vehicle_id", d.vehicle_id)
    .in("status", ["approved", "in_use", "pending"])
    .lt("start_time", end)
    .gt("end_time", start)
    .limit(1);
  if (clash?.length) return fail(`Jadwal bentrok dengan booking ${clash[0].code}. Pilih kendaraan/waktu lain.`);

  const cost = await getCostSettings();
  const hasDest = typeof d.dest_lat === "number" && typeof d.dest_lng === "number";
  const dist = hasDest ? haversineKm(cost.poolLat, cost.poolLng, d.dest_lat as number, d.dest_lng as number) : null;
  const est = dist !== null ? estimateTrip(dist, cost) : null;

  const { data: code } = await supabase.rpc("next_doc_code", { p_prefix: "BKG" });
  const { data, error } = await supabase
    .from("fleet_bookings")
    .insert({
      code,
      company: v.company,
      requester_employee_id: d.requester_employee_id,
      requested_by: session.userId,
      vehicle_id: d.vehicle_id,
      driver_id: d.driver_id || null,
      purpose: d.purpose,
      destination: d.destination,
      dest_lat: hasDest ? d.dest_lat : null,
      dest_lng: hasDest ? d.dest_lng : null,
      start_time: start,
      end_time: end,
      est_distance_km: dist !== null ? Math.round(dist * 100) / 100 : null,
      est_cost: est?.total ?? null,
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok(`Booking ${code} diajukan, menunggu persetujuan GA.`, { id: data.id });
}

export async function decideBooking(id: string, approve: boolean, driverId?: string, note?: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fleet_decide_booking", {
    p_booking: id,
    p_approve: approve,
    p_driver: driverId || null,
    p_note: note || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok(approve ? "Booking disetujui." : "Booking ditolak.");
}

export async function startTrip(id: string, override = false): Promise<ActionResult> {
  await requireModule("fleet", ["admin", "driver"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fleet_start_trip", { p_booking: id, p_override: override });
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok("Perjalanan dimulai. Biarkan halaman ini terbuka supaya GPS terkirim.");
}

export async function finishTrip(id: string, endOdo: number): Promise<ActionResult> {
  await requireModule("fleet", ["admin", "driver"]);
  if (!Number.isFinite(endOdo) || endOdo <= 0) return fail("Isi KM akhir.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fleet_finish_trip", { p_booking: id, p_end_odo: Math.round(endOdo) });
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok("Perjalanan selesai.");
}

export async function cancelBooking(id: string): Promise<ActionResult> {
  await requireModule("fleet");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fleet_cancel_booking", { p_booking: id });
  if (error) return fail(dbError(error));
  revalidatePath("/fleet", "layout");
  return ok("Booking dibatalkan.");
}
