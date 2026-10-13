"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModerator } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { DEFAULT_PASSWORD, NRP_PATTERN, looksLikeEmail, syntheticEmail } from "@/lib/auth/identity";

const BAN_FOREVER = "876000h";

const accessSchema = z.object({
  asset: z.object({ role: z.enum(["admin", "staff"]), permissions: z.record(z.string(), z.record(z.string(), z.boolean())).default({}) }).nullable().optional(),
  fleet: z.object({ role: z.enum(["admin", "driver", "employee"]) }).nullable().optional(),
  goa: z.object({ role: z.enum(["supervisor", "member", "guest"]) }).nullable().optional(),
});

const baseSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  nrp: z.string().trim().optional(),
  company: z.enum(["GMI", "GIS", "LOURDES"], { message: "Pilih perusahaan." }),
  employee_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.enum(["on"]).optional(),
  is_moderator: z.enum(["on"]).optional(),
  access: z.string().default("{}"),
});

function parseAccess(raw: string) {
  try {
    return accessSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeAccess(userId: string, access: z.infer<typeof accessSchema>) {
  const admin = createAdminClient();
  const rows = (["asset", "fleet", "goa"] as const)
    .filter((m) => access[m])
    .map((m) => ({
      user_id: userId,
      module: m,
      role: access[m]!.role,
      permissions: m === "asset" ? (access.asset?.permissions ?? {}) : {},
    }));
  const remove = (["asset", "fleet", "goa"] as const).filter((m) => !access[m]);
  if (remove.length) await admin.from("module_access").delete().eq("user_id", userId).in("module", remove);
  if (rows.length) {
    const { error } = await admin.from("module_access").upsert(rows, { onConflict: "user_id,module" });
    if (error) return error;
  }
  return null;
}

function nrpOrNull(v?: string) {
  const n = v?.trim();
  if (!n) return null;
  if (!NRP_PATTERN.test(n)) throw new Error("NRP hanya huruf, angka, titik, strip (3-30 karakter).");
  return n;
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  await requireModerator();
  const parsed = baseSchema.extend({ identifier: z.string().trim().min(1, "Isi NRP atau email.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const access = parseAccess(d.access);
  if (!access) return fail("Data akses modul tidak valid.");

  const isEmail = looksLikeEmail(d.identifier);
  let nrp: string | null;
  try {
    nrp = nrpOrNull(isEmail ? d.nrp : d.identifier);
  } catch (e) {
    return fail((e as Error).message);
  }
  const email = isEmail ? d.identifier.toLowerCase() : syntheticEmail(d.identifier);

  const admin = createAdminClient();
  if (nrp) {
    const { data: taken } = await admin.from("profiles").select("id").eq("nrp", nrp).maybeSingle();
    if (taken) return fail(`NRP ${nrp} sudah dipakai akun lain.`);
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { name: d.name, nrp },
  });
  if (error || !created.user) {
    return fail(/already|registered|exists/i.test(error?.message ?? "") ? "Email sudah terdaftar." : "Gagal membuat akun.");
  }
  const id = created.user.id;
  const active = d.is_active === "on";
  if (!active) await admin.auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER });

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      name: d.name,
      nrp,
      company: d.company,
      employee_id: d.employee_id || null,
      is_active: active,
      is_moderator: d.is_moderator === "on",
    })
    .eq("id", id);
  if (pErr) return fail(dbError(pErr));
  const aErr = await writeAccess(id, access);
  if (aErr) return fail(dbError(aErr));

  return ok(`Akun dibuat. Login: ${nrp ?? email} / ${DEFAULT_PASSWORD}`);
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const session = await requireModerator();
  const parsed = baseSchema.extend({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const access = parseAccess(d.access);
  if (!access) return fail("Data akses modul tidak valid.");
  let nrp: string | null;
  try {
    nrp = nrpOrNull(d.nrp);
  } catch (e) {
    return fail((e as Error).message);
  }

  const active = d.is_active === "on";
  const moderator = d.is_moderator === "on";
  if (d.id === session.userId && (!active || !moderator)) {
    return fail("Anda tidak bisa menonaktifkan atau mencabut Moderator dari akun sendiri.");
  }

  const admin = createAdminClient();
  if (nrp) {
    const { data: taken } = await admin.from("profiles").select("id").eq("nrp", nrp).neq("id", d.id).maybeSingle();
    if (taken) return fail(`NRP ${nrp} sudah dipakai akun lain.`);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      name: d.name,
      nrp,
      company: d.company,
      employee_id: d.employee_id || null,
      is_active: active,
      is_moderator: moderator,
    })
    .eq("id", d.id);
  if (error) return fail(dbError(error));

  await admin.auth.admin.updateUserById(d.id, {
    ban_duration: active ? "none" : BAN_FOREVER,
    user_metadata: { name: d.name, nrp },
  });
  const aErr = await writeAccess(d.id, access);
  if (aErr) return fail(dbError(aErr));
  return ok("Akun diperbarui.");
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await requireModerator();
  if (id === session.userId && !active) return fail("Anda tidak bisa menonaktifkan akun sendiri.");
  const admin = createAdminClient();
  if (active) {
    const { data: p } = await admin.from("profiles").select("company").eq("id", id).single();
    if (!p?.company) return fail("Lengkapi perusahaan akun ini dulu (Edit), baru aktifkan.");
  }
  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", id);
  if (error) return fail(dbError(error));
  await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_FOREVER });
  return ok(active ? "Akun diaktifkan." : "Akun dinonaktifkan.");
}

export async function resetPassword(id: string): Promise<ActionResult> {
  await requireModerator();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: DEFAULT_PASSWORD });
  if (error) return fail("Gagal reset password.");
  return ok(`Password direset ke ${DEFAULT_PASSWORD}.`);
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await requireModerator();
  if (id === session.userId) return fail("Anda tidak bisa menghapus akun sendiri.");
  const admin = createAdminClient();
  // Cek lewat trigger (minimal 1 Moderator) dengan menghapus profil dulu.
  const { error: pErr } = await admin.from("profiles").delete().eq("id", id);
  if (pErr) return fail(dbError(pErr, "Gagal menghapus akun."));
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return fail("Profil terhapus, tapi akun auth gagal dihapus.");
  return ok("Akun dihapus.");
}
