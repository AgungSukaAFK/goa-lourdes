"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  vehicle_id: z.string().uuid("Pilih kendaraan."),
  driver_id: z.string().uuid("Pilih driver."),
  kind: z.enum(["pre_trip", "weekly"]),
  booking_id: z.string().uuid().nullable(),
  odometer: z.number().int().min(0, "Isi KM."),
  inspector: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  answers: z.array(z.object({ item_id: z.string().uuid(), ok: z.boolean() })).min(1),
  photos: z.array(z.object({ side: z.enum(["front", "back", "left", "right", "other"]), path: z.string().max(300) })).max(8),
});

export async function submitP2h(input: z.infer<typeof schema>): Promise<ActionResult<{ id: string }>> {
  await requireModule("fleet", ["admin", "driver"]);
  const p = schema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("fleet_submit_p2h", {
    p_vehicle: d.vehicle_id,
    p_driver: d.driver_id,
    p_kind: d.kind,
    p_booking: d.booking_id,
    p_odometer: d.odometer,
    p_answers: d.answers,
    p_inspector: d.inspector,
    p_notes: d.notes,
    p_lat: d.lat,
    p_lng: d.lng,
  });
  if (error) return fail(dbError(error));
  if (d.photos.length) {
    const { error: phErr } = await supabase.from("fleet_p2h_photos").insert(d.photos.map((ph) => ({ inspection_id: id, ...ph })));
    if (phErr) return fail("P2H tersimpan, tapi foto gagal dilampirkan.");
  }
  revalidatePath("/fleet", "layout");
  return ok("P2H tersimpan.", { id: id as string });
}

export async function deleteP2h(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { data: photos } = await supabase.from("fleet_p2h_photos").select("path").eq("inspection_id", id);
  const { error, count } = await supabase.from("fleet_p2h_inspections").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("P2H tidak ditemukan.");
  if (photos?.length) await supabase.storage.from("p2h-photos").remove(photos.map((p) => p.path));
  revalidatePath("/fleet", "layout");
  return ok("P2H dihapus.");
}
