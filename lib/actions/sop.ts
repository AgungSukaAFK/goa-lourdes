"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  module: z.enum(["asset", "fleet", "goa"]),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(150),
  content_md: z.string().max(20000),
  sort: z.coerce.number().int().default(0),
});

export async function saveSop(fd: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, ...d } = p.data;
  const supabase = await createClient();
  const row = { ...d, updated_by: session.userId };
  const { error } = id
    ? await supabase.from("sop_pages").update(row).eq("id", id)
    : await supabase.from("sop_pages").insert({ ...row, slug: `${Date.now().toString(36)}` });
  if (error) return fail(dbError(error));
  revalidatePath(`/${d.module}/sop`);
  return ok("SOP disimpan.");
}

export async function deleteSop(id: string, module: string): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error, count } = await supabase.from("sop_pages").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Anda tidak punya akses menghapus SOP.");
  revalidatePath(`/${module}/sop`);
  return ok("SOP dihapus.");
}
