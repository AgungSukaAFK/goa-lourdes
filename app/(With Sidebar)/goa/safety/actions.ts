"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

export async function saveSafety(fd: FormData): Promise<ActionResult> {
  const s = await requireModule("goa", ["supervisor"]);
  const p = z
    .object({
      id: z.string().uuid().optional().or(z.literal("")),
      title: z.string().trim().min(3).max(150),
      category: z.string().trim().max(60).optional(),
      content_md: z.string().max(20000),
      is_published: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, is_published, ...d } = p.data;
  const row = { ...d, category: d.category || null, is_published: is_published === "on" };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("goa_safety_topics").update(row).eq("id", id)
    : await supabase.from("goa_safety_topics").insert({ ...row, created_by: s.userId });
  if (error) return fail(dbError(error));
  revalidatePath("/goa/safety");
  return ok("Topik disimpan.");
}

export async function deleteSafety(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("goa_safety_topics").delete().eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/goa/safety");
  return ok("Topik dihapus.");
}
