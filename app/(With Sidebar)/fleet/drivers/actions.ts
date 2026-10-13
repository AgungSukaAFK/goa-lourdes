"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  employee_id: z.string().uuid("Pilih karyawan."),
  license_no: z.string().trim().max(40).optional(),
  license_type: z.string().trim().max(20).optional(),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  vehicle_ids: z.string().default(""),
  is_active: z.enum(["on"]).optional(),
});

export async function saveDriver(fd: FormData): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("company").eq("id", d.employee_id).single();
  if (!emp) return fail("Karyawan tidak ditemukan.");
  const row = {
    employee_id: d.employee_id,
    company: emp.company,
    license_no: d.license_no || null,
    license_type: d.license_type || null,
    license_expiry: d.license_expiry || null,
    is_active: d.is_active === "on",
  };
  const res = d.id
    ? await supabase.from("fleet_drivers").update(row).eq("id", d.id).select("id").single()
    : await supabase.from("fleet_drivers").insert(row).select("id").single();
  if (res.error) return fail(res.error.code === "23505" ? "Karyawan ini sudah terdaftar sebagai driver." : dbError(res.error));
  const driverId = res.data.id;

  const ids = d.vehicle_ids.split(",").filter(Boolean);
  await supabase.from("fleet_driver_vehicles").delete().eq("driver_id", driverId);
  if (ids.length) {
    const { error } = await supabase.from("fleet_driver_vehicles").insert(ids.map((vehicle_id) => ({ driver_id: driverId, vehicle_id })));
    if (error) return fail(dbError(error));
  }
  return ok(d.id ? "Driver diperbarui." : "Driver ditambahkan.");
}

export async function deleteDriver(id: string): Promise<ActionResult> {
  await requireModule("fleet", ["admin"]);
  const supabase = await createClient();
  const { error, count } = await supabase.from("fleet_drivers").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error, "Gagal menghapus driver. Nonaktifkan saja."));
  if (!count) return fail("Driver tidak ditemukan.");
  return ok("Driver dihapus.");
}
