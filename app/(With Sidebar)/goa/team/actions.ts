"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

export async function saveMember(fd: FormData): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const p = z
    .object({
      profile_id: z.string().uuid(),
      title: z.string().trim().max(80).optional(),
      sp_level: z.enum(["none", "sp1", "sp2", "sp3"]),
      sp_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
      presence_status: z.enum(["hadir", "cuti", "sakit", "izin", "dinas"]),
      backup_profile_id: z.string().uuid().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.sp_level !== "none" && !d.sp_date) return fail("Isi tanggal terbit SP.");
  const supabase = await createClient();
  const { error } = await supabase.from("goa_members").upsert({
    profile_id: d.profile_id,
    title: d.title || null,
    sp_level: d.sp_level,
    sp_date: d.sp_level === "none" ? null : d.sp_date,
    presence_status: d.presence_status,
    backup_profile_id: d.backup_profile_id || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/goa", "layout");
  return ok("Data anggota disimpan.");
}
