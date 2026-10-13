"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetCan, requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  asset_id: z.string().uuid("Pilih aset."),
  borrower_employee_id: z.string().uuid("Pilih peminjam."),
  borrow_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal pinjam."),
  expected_return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal kembali."),
  purpose: z.string().trim().min(3, "Isi tujuan penggunaan.").max(500),
  approve_now: z.enum(["on"]).optional(),
});

export async function requestLoan(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "loans", "write")) return fail("Anda tidak punya akses mengajukan peminjaman.");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.expected_return_date < d.borrow_date) return fail("Tanggal kembali tidak boleh sebelum tanggal pinjam.");

  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("company, status, is_borrowable, code").eq("id", d.asset_id).single();
  if (!asset) return fail("Aset tidak ditemukan.");
  if (!asset.is_borrowable) return fail(`Aset ${asset.code} tidak ditandai "dapat dipinjam".`);
  if (asset.status !== "ready") return fail(`Aset ${asset.code} sedang tidak tersedia.`);

  const { data: code, error: cErr } = await supabase.rpc("next_doc_code", { p_prefix: "LN" });
  if (cErr) return fail(dbError(cErr));
  const { data: loan, error } = await supabase
    .from("asset_loans")
    .insert({
      code,
      asset_id: d.asset_id,
      borrower_employee_id: d.borrower_employee_id,
      borrow_date: d.borrow_date,
      expected_return_date: d.expected_return_date,
      purpose: d.purpose,
      company: asset.company,
      requested_by: session.userId,
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "Aset ini sudah punya pengajuan pinjam yang berjalan." : dbError(error));

  if (d.approve_now === "on" && session.role === "admin") {
    const { error: aErr } = await supabase.rpc("asset_decide_loan", { p_loan: loan.id, p_approve: true });
    if (aErr) return fail(dbError(aErr));
    revalidatePath("/asset", "layout");
    return ok(`Peminjaman ${code} dibuat & disetujui.`);
  }
  revalidatePath("/asset", "layout");
  return ok(`Pengajuan ${code} terkirim, menunggu persetujuan GA.`);
}

export async function decideLoan(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireModule("asset", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("asset_decide_loan", { p_loan: id, p_approve: approve, p_note: note || null });
  if (error) return fail(dbError(error));
  revalidatePath("/asset", "layout");
  return ok(approve ? "Peminjaman disetujui." : "Peminjaman ditolak.");
}

export async function returnLoan(id: string, condition: "ready" | "damaged" | "lost", note?: string): Promise<ActionResult> {
  await requireModule("asset", ["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("asset_return_loan", { p_loan: id, p_condition: condition, p_note: note || null });
  if (error) return fail(dbError(error));
  revalidatePath("/asset", "layout");
  return ok("Pengembalian dicatat.");
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "loans", "delete")) return fail("Anda tidak punya akses menghapus.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("asset_loans").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Hanya pengajuan yang menunggu / ditolak yang bisa dihapus.");
  revalidatePath("/asset", "layout");
  return ok("Pengajuan dihapus.");
}
