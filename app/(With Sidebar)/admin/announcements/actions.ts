"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModerator } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

export async function createAnnouncement(fd: FormData): Promise<ActionResult> {
  const s = await requireModerator();
  const p = z
    .object({
      title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(150),
      body: z.string().trim().max(1000).optional(),
      link: z.string().trim().max(300).optional(),
      company: z.enum(["ALL", "GMI", "GIS"]),
      module: z.enum(["ALL", "asset", "fleet", "goa"]),
      days: z.coerce.number().int().min(1).max(90),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.link && !d.link.startsWith("/")) return fail("Link harus diawali / (halaman di GOA HZ).");
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    title: d.title,
    body: d.body || null,
    link: d.link || null,
    company: d.company === "ALL" ? null : d.company,
    module: d.module === "ALL" ? null : d.module,
    expires_at: new Date(Date.now() + d.days * 86400000).toISOString(),
    created_by: s.userId,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/admin/announcements");
  return ok("Pengumuman dikirim.");
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireModerator();
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin/announcements");
  return ok("Pengumuman dihapus.");
}
