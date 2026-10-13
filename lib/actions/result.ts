export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

export const ok = <T = undefined>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Pesan error Postgres/Supabase yang ramah user. */
export function dbError(error: { code?: string; message: string } | null | undefined, fallback = "Gagal menyimpan data."): string {
  if (!error) return fallback;
  if (error.code === "23505") return "Data dengan nilai yang sama sudah ada.";
  if (error.code === "23503") return "Data masih dipakai di tempat lain.";
  if (error.code === "42501") return error.message.includes("row-level security") ? "Anda tidak punya akses untuk aksi ini." : error.message;
  if (error.code === "23514" || error.code === "P0001") return error.message;
  return fallback;
}
