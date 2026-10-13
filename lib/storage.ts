import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Signed URL untuk file di bucket private (default 1 jam). */
export async function signedUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Signed URL banyak sekaligus -> map path => url. */
export async function signedUrls(bucket: string, paths: (string | null | undefined)[], expiresIn = 3600) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {} as Record<string, string>;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, expiresIn);
  const map: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  return map;
}
