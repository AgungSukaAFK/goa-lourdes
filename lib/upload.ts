"use client";

import { createClient } from "@/lib/supabase/client";

/** Kompres foto di browser sebelum upload (default maks 1600px / ~0.6MB). */
export async function compressImage(file: File, opts: { maxWidthOrHeight?: number; maxSizeMB?: number } = {}) {
  if (!file.type.startsWith("image/")) return file;
  const imageCompression = (await import("browser-image-compression")).default;
  const out = await imageCompression(file, {
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 1600,
    maxSizeMB: opts.maxSizeMB ?? 0.6,
    useWebWorker: true,
    fileType: "image/webp",
  });
  return new File([out], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

/**
 * Upload langsung dari browser ke Supabase Storage (tidak lewat server
 * action, karena limit body Vercel 4.5MB). Mengembalikan path di bucket.
 */
export async function uploadFile(bucket: string, folder: string, file: File, opts: { compress?: boolean } = {}) {
  const body = opts.compress === false ? file : await compressImage(file);
  const ext = body.name.split(".").pop() ?? "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: body.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeFile(bucket: string, path: string) {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([path]);
}
