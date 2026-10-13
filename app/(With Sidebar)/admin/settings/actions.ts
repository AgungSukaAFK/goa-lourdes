"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModerator } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  GMI: z.string().trim().min(3).max(120).includes("{NUM}", { message: "Format wajib mengandung {NUM} supaya kode unik." }),
  GIS: z.string().trim().min(3).max(120).includes("{NUM}", { message: "Format wajib mengandung {NUM} supaya kode unik." }),
});

export async function saveCodeFormats(fd: FormData): Promise<ActionResult> {
  const session = await requireModerator();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(
    (["GMI", "GIS"] as const).map((c) => ({
      key: "asset_code_format",
      company: c,
      value: p.data[c].toUpperCase(),
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) return fail(dbError(error));
  revalidatePath("/admin/settings");
  return ok("Format kode aset disimpan. Berlaku untuk aset baru.");
}
