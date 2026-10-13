"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter.").max(80),
  code: z.string().trim().max(5).optional(),
  depreciation_years: z.coerce.number().int().min(0).max(50),
});

export async function saveCategory(fd: FormData): Promise<ActionResult> {
  await requireModule("asset");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, code, ...d } = p.data;
  const row = { ...d, code: code ? code.toUpperCase() : null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("asset_categories").update(row).eq("id", id)
    : await supabase.from("asset_categories").insert(row);
  if (error) return fail(dbError(error));
  return ok(id ? "Kategori diperbarui." : "Kategori ditambahkan.");
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireModule("asset");
  const supabase = await createClient();
  const { error, count } = await supabase.from("asset_categories").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Anda tidak punya akses menghapus kategori.");
  return ok("Kategori dihapus.");
}
