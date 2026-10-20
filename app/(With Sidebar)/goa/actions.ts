"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { signedUrls } from "@/lib/storage";
import type { GoaFileKind, GoaTaskFile } from "@/lib/goa/types";

const GOA_BUCKET = "goa-files";

const done = (msg: string) => {
  revalidatePath("/goa", "layout");
  return ok(msg);
};

const taskSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  description: z.string().trim().max(2000).optional(),
  job_category: z.string().trim().max(60).optional(),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  reviewer_id: z.string().uuid().optional().or(z.literal("")),
  start_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional().or(z.literal("")),
  due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional().or(z.literal("")),
  company: z.enum(["GMI", "GIS", "LOURDES"]).optional(),
});

export async function saveTask(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const s = await requireModule("goa", ["supervisor", "member"]);
  const p = taskSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  // Format sama (YYYY-MM-DDTHH:mm WIB), jadi bisa dibandingkan sebagai string.
  if (d.start_at && d.due_at && d.start_at > d.due_at) return fail("Jadwal mulai harus sebelum batas waktu.");
  const supabase = await createClient();
  const row = {
    title: d.title,
    description: d.description || null,
    job_category: d.job_category || null,
    assignee_id: d.assignee_id || null,
    reviewer_id: d.reviewer_id || null,
    start_at: d.start_at ? `${d.start_at}:00+07:00` : null,
    due_at: d.due_at ? `${d.due_at}:00+07:00` : null,
  };
  if (d.id) {
    // Field jadwal mulai dikunci (tidak terkirim) kalau tugas sudah berjalan: jangan ikut dikosongkan.
    // (undefined tidak ikut di-JSON-kan, jadi kolomnya tidak diubah)
    const patch = fd.has("start_at") ? row : { ...row, start_at: undefined };
    const { error, count } = await supabase.from("goa_tasks").update(patch, { count: "exact" }).eq("id", d.id);
    if (error) return fail(dbError(error));
    if (!count) return fail("Hanya atasan yang bisa mengubah tugas.");
    revalidatePath("/goa", "layout");
    return ok("Tugas diperbarui.", { id: d.id });
  }
  if (s.role === "member" && row.assignee_id && row.assignee_id !== s.userId) {
    return fail("Anggota hanya bisa membuat tugas untuk dirinya sendiri atau General Pool.");
  }
  const company = d.company ?? s.profile.company ?? "LOURDES";
  const { data: code } = await supabase.rpc("next_doc_code", { p_prefix: "TSK" });
  const { data, error } = await supabase.from("goa_tasks").insert({ ...row, code, company, created_by: s.userId }).select("id").single();
  if (error) return fail(dbError(error));
  revalidatePath("/goa", "layout");
  return ok(`Tugas ${code} dibuat.`, { id: data.id as string });
}

/** Path lampiran tugas, diambil sebelum tugas dihapus (baris lampiran ikut terhapus cascade). */
async function filePaths(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const { data } = await supabase.from("goa_task_files").select("path").in("task_id", ids);
  return (data ?? []).map((f) => f.path as string);
}

async function removeStorage(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  // Best effort: file yang bukan milik user (dan user bukan atasan) dibiarkan oleh policy storage.
  if (paths.length) await supabase.storage.from(GOA_BUCKET).remove(paths);
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireModule("goa");
  const supabase = await createClient();
  const paths = await filePaths(supabase, [id]);
  const { error, count } = await supabase.from("goa_tasks").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Tugas tidak bisa dihapus (bukan milik Anda atau sudah dikerjakan).");
  await removeStorage(supabase, paths);
  return done("Tugas dihapus.");
}

export async function startTask(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor", "member"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_start_task", { p_task: id });
  if (error) return fail(dbError(error));
  return done("Tugas mulai dikerjakan.");
}

export async function finishTask(id: string, isDone: boolean, note: string, files: UploadedFile[] = []): Promise<ActionResult> {
  await requireModule("goa", ["supervisor", "member"]);
  const p = filesSchema.safeParse(files);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  if (isDone && p.data.length) {
    const { error } = await supabase.rpc("goa_add_task_files", { p_task: id, p_kind: "after", p_files: p.data });
    if (error) return fail(dbError(error));
  }
  const { error } = await supabase.rpc("goa_finish_task", { p_task: id, p_done: isDone, p_note: note || null });
  if (error) {
    // Lepas lagi bukti yang baru dicatat, supaya kirim ulang tidak menggandakan lampiran.
    if (isDone && p.data.length) await dropFiles(supabase, p.data.map((f) => f.path));
    return fail(dbError(error));
  }
  return done(isDone ? "Tugas selesai." : "Tugas ditutup tidak selesai.");
}

// ---------------------------------------------------------------------------
// Lampiran
// ---------------------------------------------------------------------------
const filesSchema = z
  .array(
    z.object({
      path: z.string().min(1).max(300),
      name: z.string().max(300),
      mime: z.string().max(150),
      size: z.number().int().nonnegative(),
    }),
  )
  .max(10, "Maksimal 10 lampiran sekali upload.");

type UploadedFile = z.infer<typeof filesSchema>[number];

async function dropFiles(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  const { data } = await supabase.from("goa_task_files").select("id").in("path", paths);
  for (const f of data ?? []) await supabase.rpc("goa_delete_task_file", { p_file: f.id });
  await removeStorage(supabase, paths);
}

export async function addTaskFiles(id: string, kind: GoaFileKind, files: UploadedFile[]): Promise<ActionResult> {
  await requireModule("goa");
  const p = filesSchema.min(1, "Pilih file yang akan dilampirkan.").safeParse(files);
  if (!p.success) return fail(p.error.issues[0].message);
  if (!["before", "after", "review"].includes(kind)) return fail("Jenis lampiran tidak valid.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("goa_add_task_files", { p_task: id, p_kind: kind, p_files: p.data });
  if (error) return fail(dbError(error));
  return done(`${data} lampiran ditambahkan.`);
}

export async function listTaskFiles(id: string): Promise<ActionResult<GoaTaskFile[]>> {
  await requireModule("goa");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goa_task_files")
    .select("id, task_id, kind, path, name, mime, size, uploaded_by, created_at, uploader:profiles!goa_task_files_uploaded_by_fkey(name)")
    .eq("task_id", id)
    .order("created_at");
  if (error) return fail(dbError(error, "Gagal memuat lampiran."));
  const urls = await signedUrls(GOA_BUCKET, data.map((f) => f.path));
  return ok(
    undefined,
    data.map(({ uploader, ...f }) => ({
      ...f,
      uploader_name: (uploader as unknown as { name: string } | null)?.name ?? null,
      url: urls[f.path] ?? null,
    })) as GoaTaskFile[],
  );
}

export async function deleteTaskFile(fileId: string): Promise<ActionResult> {
  await requireModule("goa");
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("goa_delete_task_file", { p_file: fileId });
  if (error) return fail(dbError(error));
  await removeStorage(supabase, [path as string]);
  return done("Lampiran dihapus.");
}

export async function rateTask(id: string, rating: number): Promise<ActionResult> {
  await requireModule("goa");
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_rate_task", { p_task: id, p_rating: rating });
  if (error) return fail(dbError(error));
  return done(`Dinilai ${rating}/5.`);
}

const idsSchema = z.array(z.string().uuid()).min(1, "Pilih minimal satu tugas.").max(500, "Maksimal 500 tugas sekali proses.");

export async function rateTasks(ids: string[], rating: number): Promise<ActionResult> {
  await requireModule("goa");
  const p = idsSchema.safeParse(ids);
  if (!p.success) return fail(p.error.issues[0].message);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Nilai 1-5.");
  const supabase = await createClient();
  // Atomik: kalau satu tugas tidak boleh dinilai, tidak ada yang tersimpan.
  const { data, error } = await supabase.rpc("goa_rate_tasks", { p_tasks: p.data, p_rating: rating });
  if (error) return fail(dbError(error));
  return done(`${data} tugas dinilai ${rating}/5.`);
}

export async function deleteTasks(ids: string[]): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const p = idsSchema.safeParse(ids);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const paths = await filePaths(supabase, p.data);
  const { error, count } = await supabase.from("goa_tasks").delete({ count: "exact" }).in("id", p.data);
  if (error) return fail(dbError(error));
  if (!count) return fail("Tidak ada tugas yang terhapus.");
  await removeStorage(supabase, paths);
  return done(count < p.data.length ? `${count} dari ${p.data.length} tugas dihapus (sisanya tidak ditemukan / tanpa akses).` : `${count} tugas dihapus.`);
}

export async function reopenTask(id: string): Promise<ActionResult> {
  await requireModule("goa", ["supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("goa_reopen_task", { p_task: id });
  if (error) return fail(dbError(error));
  return done("Tugas dibuka kembali.");
}

export async function exportTasks(params: Record<string, string>): Promise<ActionResult<Record<string, unknown>[]>> {
  await requireModule("goa");
  const supabase = await createClient();
  let q = supabase.from("goa_tasks_view").select("*").order("created_at", { ascending: false }).limit(10000);
  if (params.status === "overdue") q = q.eq("is_overdue", true);
  else if (params.status) q = q.eq("status", params.status);
  if (params.member === "pool") q = q.is("assignee_id", null);
  else if (params.member) q = q.eq("assignee_id", params.member);
  if (params.category) q = q.eq("job_category", params.category);
  if (params.rated === "no") q = q.in("status", ["done", "undone", "expired"]).is("rating", null);
  else if (params.rated === "yes") q = q.not("rating", "is", null);
  if (params.from) q = q.gte("created_at", `${params.from}T00:00:00+07:00`);
  if (params.to) q = q.lte("created_at", `${params.to}T23:59:59+07:00`);
  const { data, error } = await q;
  if (error) return fail(dbError(error));
  return ok(undefined, data as Record<string, unknown>[]);
}

export type ProofPhoto = { task_id: string; code: string; title: string; assignee_name: string | null; completed_at: string | null; url: string };

/** Foto bukti selesai untuk laporan PPTX (maks 48, terbaru dulu). */
export async function exportProofPhotos(taskIds: string[]): Promise<ActionResult<ProofPhoto[]>> {
  await requireModule("goa");
  if (!taskIds.length) return ok(undefined, []);
  const supabase = await createClient();
  const photos: { task_id: string; path: string }[] = [];
  // Dipecah supaya URL query tidak kepanjangan.
  for (let i = 0; i < taskIds.length && photos.length < 48; i += 200) {
    const { data, error } = await supabase
      .from("goa_task_files")
      .select("task_id, path")
      .in("task_id", taskIds.slice(i, i + 200))
      .eq("kind", "after")
      .like("mime", "image/%")
      .order("created_at", { ascending: false })
      .limit(48 - photos.length);
    if (error) return fail(dbError(error, "Gagal memuat foto bukti."));
    photos.push(...(data as { task_id: string; path: string }[]));
  }
  if (!photos.length) return ok(undefined, []);
  const { data: tasks } = await supabase
    .from("goa_tasks_view")
    .select("id, code, title, assignee_name, completed_at")
    .in("id", [...new Set(photos.map((p) => p.task_id))]);
  const byId = new Map((tasks ?? []).map((t) => [t.id as string, t]));
  const urls = await signedUrls(GOA_BUCKET, photos.map((p) => p.path), 600);
  return ok(
    undefined,
    photos
      .filter((p) => urls[p.path] && byId.has(p.task_id))
      .map((p) => {
        const t = byId.get(p.task_id)!;
        return { task_id: p.task_id, code: t.code, title: t.title, assignee_name: t.assignee_name, completed_at: t.completed_at, url: urls[p.path] };
      }),
  );
}
