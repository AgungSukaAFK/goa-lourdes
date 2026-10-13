"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nama site minimal 2 karakter.").max(100),
  company: z.enum(["GMI", "GIS", "LOURDES"]),
  address: z.string().trim().max(300).optional(),
  is_active: z.enum(["on"]).optional(),
});

export async function saveSite(formData: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, is_active, ...data } = parsed.data;

  const supabase = await createClient();
  const row = { ...data, address: data.address || null, is_active: is_active === "on" };
  const { error } = id
    ? await supabase.from("sites").update(row).eq("id", id)
    : await supabase.from("sites").insert(row);
  if (error) return fail(dbError(error));
  return ok(id ? "Site diperbarui." : "Site ditambahkan.");
}

export async function deleteSite(id: string): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error, count } = await supabase.from("sites").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error, "Gagal menghapus site."));
  if (!count) return fail("Site tidak ditemukan atau Anda tidak punya akses.");
  return ok("Site dihapus.");
}
