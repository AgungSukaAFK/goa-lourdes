"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetCan, requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  asset_id: z.string().uuid("Pilih aset."),
  to_employee_id: z.string().uuid("Pilih karyawan penerima."),
  to_site_id: z.string().uuid().optional().or(z.literal("")),
  reason: z.string().trim().min(3, "Isi alasan mutasi.").max(500),
  direct: z.enum(["on"]).optional(),
});

export async function requestMutation(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "mutations", "write")) return fail("Anda tidak punya akses mengajukan mutasi.");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const direct = d.direct === "on" && session.role === "admin";

  const supabase = await createClient();
  const [{ data: asset }, { data: target }] = await Promise.all([
    supabase.from("assets").select("company, status, code, owner_employee_id, site_id").eq("id", d.asset_id).single(),
    supabase.from("employees").select("site_id").eq("id", d.to_employee_id).single(),
  ]);
  if (!asset) return fail("Aset tidak ditemukan.");
  if (asset.owner_employee_id === d.to_employee_id) return fail("Penerima sama dengan pemegang saat ini.");
  if (asset.status === "loaned") return fail("Aset sedang dipinjam. Selesaikan peminjaman dulu.");

  const { data: code, error: cErr } = await supabase.rpc("next_doc_code", { p_prefix: "MT" });
  if (cErr) return fail(dbError(cErr));
  const { data: mut, error } = await supabase
    .from("asset_mutations")
    .insert({
      code,
      asset_id: d.asset_id,
      company: asset.company,
      from_employee_id: asset.owner_employee_id,
      to_employee_id: d.to_employee_id,
      from_site_id: asset.site_id,
      to_site_id: d.to_site_id || target?.site_id || asset.site_id,
      reason: d.reason,
      is_direct: direct,
      requested_by: session.userId,
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "Aset ini sudah punya pengajuan mutasi yang menunggu." : dbError(error));

  if (direct) {
    const { error: aErr } = await supabase.rpc("asset_decide_mutation", { p_mutation: mut.id, p_approve: true });
    if (aErr) return fail(dbError(aErr));
  }
  revalidatePath("/asset", "layout");
  return ok(direct ? `Mutasi ${code} langsung diterapkan.` : `Pengajuan mutasi ${code} terkirim.`);
}

export async function decideMutation(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireModule("asset", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("asset_decide_mutation", { p_mutation: id, p_approve: approve, p_note: note || null });
  if (error) return fail(dbError(error));
  revalidatePath("/asset", "layout");
  return ok(approve ? "Mutasi disetujui, pemegang aset diperbarui." : "Mutasi ditolak.");
}

export async function deleteMutation(id: string): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "mutations", "delete")) return fail("Anda tidak punya akses menghapus.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("asset_mutations").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Hanya pengajuan yang menunggu / ditolak yang bisa dihapus.");
  revalidatePath("/asset", "layout");
  return ok("Pengajuan mutasi dihapus.");
}
