"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { NRP_PATTERN, looksLikeEmail, syntheticEmail } from "@/lib/auth/identity";

export type AuthState = { error?: string } | undefined;

/** Email akun untuk login: langsung kalau email, cari dari NRP kalau bukan. */
async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (looksLikeEmail(identifier)) return identifier.toLowerCase();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("nrp", identifier)
    .maybeSingle();
  return data?.email ?? null;
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = getSafeNextPath(String(formData.get("next") ?? ""));

  if (!identifier || !password) return { error: "Isi email/NRP dan password." };

  const email = await resolveLoginEmail(identifier);
  // Pesan sama untuk NRP tidak terdaftar & password salah (tidak bocorkan akun).
  const invalid = { error: "Email/NRP atau password salah." };
  if (!email) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return invalid;

  redirect(next ?? "/");
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !name || !password) return { error: "Semua field wajib diisi." };
  if (name.length < 2) return { error: "Nama terlalu pendek." };
  if (password.length < 6) return { error: "Password minimal 6 karakter." };

  const isEmail = looksLikeEmail(identifier);
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return { error: "Format email tidak valid." };
  }
  if (!isEmail && !NRP_PATTERN.test(identifier)) {
    return { error: "NRP hanya boleh huruf, angka, titik, strip (3-30 karakter)." };
  }

  const admin = createAdminClient();
  const nrp = isEmail ? null : identifier;
  const email = isEmail ? identifier.toLowerCase() : syntheticEmail(identifier);

  if (nrp) {
    const { data: taken } = await admin.from("profiles").select("id").eq("nrp", nrp).maybeSingle();
    if (taken) return { error: "NRP sudah terdaftar. Silakan login atau hubungi admin." };
  }

  // Auto confirm: akun langsung bisa login, tapi nonaktif (profiles.is_active
  // default false) sampai Moderator melengkapi data & mengaktifkan.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, nrp },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: "Akun sudah terdaftar. Silakan login." };
    }
    return { error: "Gagal mendaftar. Coba lagi nanti." };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/pending");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
