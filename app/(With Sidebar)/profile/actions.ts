"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

export async function updateMyName(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const name = z.string().trim().min(2).max(120).safeParse(formData.get("name"));
  if (!name.success) return fail("Nama minimal 2 karakter.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ name: name.data }).eq("id", session.userId);
  if (error) return fail(dbError(error));
  revalidatePath("/", "layout");
  return ok("Nama diperbarui.");
}

export async function setMyAvatar(path: string | null): Promise<ActionResult> {
  const session = await requireSession();
  if (path && !path.startsWith(`${session.userId}/`)) return fail("Path foto tidak valid.");
  const supabase = await createClient();
  const old = session.profile.avatar_path;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", session.userId);
  if (error) return fail(dbError(error));
  if (old && old !== path) await supabase.storage.from("avatars").remove([old]);
  revalidatePath("/", "layout");
  return ok(path ? "Foto profil diperbarui." : "Foto profil dihapus.");
}
