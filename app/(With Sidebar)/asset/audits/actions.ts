"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetCan, requireModule } from "@/lib/auth/session";
import { getCompanyFilter } from "@/lib/company";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const createSchema = z.object({
  mode: z.enum(["random", "selected"]),
  count: z.coerce.number().int().min(1).max(200).default(5),
  asset_ids: z.string().default(""),
  site_id: z.string().uuid().optional().or(z.literal("")),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal jatuh tempo."),
});

export async function createAudits(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "audits", "write")) return fail("Anda tidak punya akses membuat audit.");
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();

  let ids: string[];
  if (d.mode === "selected") {
    ids = d.asset_ids.split(",").filter(Boolean);
    if (!ids.length) return fail("Pilih minimal satu aset.");
  } else {
    // Acak dari aset aktif yang belum punya audit menunggu.
    const filter = await getCompanyFilter(session);
    let q = supabase.from("assets").select("id").in("status", ["ready", "loaned", "damaged"]);
    if (filter) q = q.eq("company", filter);
    if (d.site_id) q = q.eq("site_id", d.site_id);
    const [{ data: pool }, { data: waiting }] = await Promise.all([
      q.limit(20000),
      supabase.from("asset_audits").select("asset_id").eq("status", "waiting"),
    ]);
    const busy = new Set((waiting ?? []).map((w) => w.asset_id));
    const candidates = (pool ?? []).map((a) => a.id as string).filter((id) => !busy.has(id));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    ids = candidates.slice(0, d.count);
    if (!ids.length) return fail("Tidak ada aset yang bisa diaudit (semua sudah punya audit berjalan).");
  }

  const { data: assets } = await supabase.from("assets").select("id, company").in("id", ids);
  const rows = [];
  for (const a of assets ?? []) {
    const { data: code } = await supabase.rpc("next_doc_code", { p_prefix: "AUD" });
    rows.push({ code, asset_id: a.id, company: a.company, due_date: d.due_date, created_by: session.userId });
  }
  const { error } = await supabase.from("asset_audits").insert(rows);
  if (error) return fail(dbError(error));
  revalidatePath("/asset", "layout");
  return ok(`${rows.length} tugas audit dibuat.`);
}

const realizeSchema = z.object({
  id: z.string().uuid(),
  condition: z.enum(["ready", "damaged", "lost", "loaned"]),
  notes: z.string().trim().min(3, "Isi catatan temuan.").max(1000),
  photo_path: z.string().max(300).optional(),
});

export async function realizeAudit(fd: FormData): Promise<ActionResult> {
  await requireModule("asset");
  const p = realizeSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("asset_realize_audit", {
    p_audit: d.id,
    p_condition: d.condition,
    p_notes: d.notes,
    p_photo: d.photo_path || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/asset", "layout");
  return ok("Hasil audit disimpan.");
}

export async function deleteAudit(id: string): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "audits", "delete")) return fail("Anda tidak punya akses menghapus audit.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("asset_audits").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Audit tidak ditemukan.");
  revalidatePath("/asset", "layout");
  return ok("Audit dihapus.");
}
