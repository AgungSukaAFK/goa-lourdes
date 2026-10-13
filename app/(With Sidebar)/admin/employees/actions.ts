"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModerator, requireSession } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { DEFAULT_PASSWORD, syntheticEmail } from "@/lib/auth/identity";
import { parseCompany } from "@/lib/company-parse";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nrp: z.string().trim().regex(/^[A-Za-z0-9._-]{3,30}$/, "NRP hanya huruf, angka, titik, strip (3-30 karakter)."),
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  company: z.enum(["GMI", "GIS", "LOURDES"], { message: "Pilih perusahaan." }),
  position: z.string().trim().max(100).optional(),
  division: z.string().trim().max(100).optional(),
  site_id: z.string().uuid().optional().or(z.literal("")),
  join_date: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Format email tidak valid.").optional().or(z.literal("")),
  is_active: z.enum(["on"]).optional(),
});

const nullIfEmpty = (v?: string) => (v ? v : null);

export async function saveEmployee(formData: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, is_active, ...d } = parsed.data;

  const row = {
    nrp: d.nrp,
    name: d.name,
    company: d.company,
    position: nullIfEmpty(d.position),
    division: nullIfEmpty(d.division),
    site_id: nullIfEmpty(d.site_id),
    join_date: nullIfEmpty(d.join_date),
    phone: nullIfEmpty(d.phone),
    email: nullIfEmpty(d.email),
    is_active: is_active === "on",
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("employees").update(row).eq("id", id)
    : await supabase.from("employees").insert(row);
  if (error) return fail(error.code === "23505" ? `NRP ${d.nrp} sudah terdaftar.` : dbError(error));
  return ok(id ? "Data karyawan diperbarui." : "Karyawan ditambahkan.");
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error, count } = await supabase.from("employees").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error, "Gagal menghapus karyawan. Mungkin masih dipakai di aset/booking; nonaktifkan saja."));
  if (!count) return fail("Karyawan tidak ditemukan atau Anda tidak punya akses.");
  return ok("Karyawan dihapus.");
}

const IMPORT_HEADERS = {
  nrp: "NRP",
  name: "Nama",
  company: "PT",
  position: "Jabatan",
  division: "Divisi",
  site: "Site",
  join_date: "Tanggal Masuk",
  phone: "No HP",
  email: "Email",
} as const;

export async function importEmployees(
  rows: Record<string, string>[],
): Promise<ActionResult<{ errors?: string[] }>> {
  await requireSession();
  if (rows.length > 5000) return fail("Maksimal 5.000 baris per import.");
  const supabase = await createClient();

  const { data: sites } = await supabase.from("sites").select("id, name, company");
  const siteKey = (name: string, company: string) => `${company}|${name.trim().toLowerCase()}`;
  const siteMap = new Map((sites ?? []).map((s) => [siteKey(s.name, s.company), s.id as string]));

  const errors: string[] = [];
  const valid: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const nrp = (r[IMPORT_HEADERS.nrp] ?? "").trim();
    const name = (r[IMPORT_HEADERS.name] ?? "").trim();
    const company = parseCompany(r[IMPORT_HEADERS.company]);
    if (!nrp || !name) {
      errors.push(`Baris ${line}: NRP dan Nama wajib diisi.`);
      continue;
    }
    if (!company) {
      errors.push(`Baris ${line} (${nrp}): PT tidak dikenali, isi GMI / GIS / LOURDES.`);
      continue;
    }
    if (seen.has(nrp)) {
      errors.push(`Baris ${line}: NRP ${nrp} dobel di file.`);
      continue;
    }
    seen.add(nrp);

    let site_id: string | null = null;
    const siteName = (r[IMPORT_HEADERS.site] ?? "").trim();
    if (siteName) {
      site_id = siteMap.get(siteKey(siteName, company)) ?? siteMap.get(siteKey(siteName, "LOURDES")) ?? null;
      if (!site_id) {
        const { data: created, error } = await supabase
          .from("sites")
          .insert({ name: siteName, company })
          .select("id")
          .single();
        if (error) {
          errors.push(`Baris ${line}: site "${siteName}" gagal dibuat.`);
        } else {
          site_id = created.id;
          siteMap.set(siteKey(siteName, company), created.id);
        }
      }
    }

    const joinDate = (r[IMPORT_HEADERS.join_date] ?? "").trim();
    valid.push({
      nrp,
      name,
      company,
      position: r[IMPORT_HEADERS.position] || null,
      division: r[IMPORT_HEADERS.division] || null,
      site_id,
      join_date: /^\d{4}-\d{2}-\d{2}$/.test(joinDate) ? joinDate : null,
      phone: r[IMPORT_HEADERS.phone] || null,
      email: r[IMPORT_HEADERS.email] || null,
    });
  }

  let saved = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500);
    const { error } = await supabase.from("employees").upsert(chunk, { onConflict: "nrp" });
    if (error) {
      errors.push(`Baris ${i + 2}–${i + 1 + chunk.length}: ${dbError(error)}`);
    } else saved += chunk.length;
  }

  return ok(`${saved} karyawan tersimpan${errors.length ? `, ${errors.length} baris dilewati` : ""}.`, { errors });
}

/**
 * Buat akun login untuk karyawan (Moderator). Email = email karyawan atau
 * `nrp@demo.com`, password `demo1234`, langsung aktif tanpa akses modul.
 */
export async function createAccounts(employeeIds: string[]): Promise<ActionResult> {
  await requireModerator();
  const admin = createAdminClient();
  const { data: emps, error } = await admin
    .from("employees")
    .select("id, nrp, name, company, email")
    .in("id", employeeIds);
  if (error) return fail(dbError(error));

  const { data: existing } = await admin
    .from("profiles")
    .select("employee_id, nrp")
    .or(`employee_id.in.(${employeeIds.join(",")}),nrp.in.(${(emps ?? []).map((e) => `"${e.nrp}"`).join(",") || '""'})`);
  const taken = new Set((existing ?? []).flatMap((p) => [p.employee_id, p.nrp]).filter(Boolean));

  let created = 0;
  const skipped: string[] = [];
  for (const e of emps ?? []) {
    if (taken.has(e.id) || taken.has(e.nrp)) {
      skipped.push(e.nrp);
      continue;
    }
    const email = (e.email as string | null)?.toLowerCase() || syntheticEmail(e.nrp);
    const { data: user, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: e.name, nrp: e.nrp },
    });
    if (authErr || !user.user) {
      skipped.push(e.nrp);
      continue;
    }
    await admin
      .from("profiles")
      .update({ employee_id: e.id, nrp: e.nrp, company: e.company, is_active: true })
      .eq("id", user.user.id);
    created++;
  }

  if (!created && skipped.length) return fail(`Akun tidak dibuat: ${skipped.join(", ")} sudah punya akun atau email bentrok.`);
  return ok(
    `${created} akun dibuat (password: ${DEFAULT_PASSWORD}).${skipped.length ? ` Dilewati: ${skipped.join(", ")}.` : ""} Atur akses modulnya di User Management.`,
  );
}

export async function exportEmployees(): Promise<ActionResult<Record<string, unknown>[]>> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("nrp, name, company, position, division, join_date, phone, email, is_active, site:sites(name)")
    .order("name");
  if (error) return fail(dbError(error));
  return ok(undefined, data as Record<string, unknown>[]);
}
