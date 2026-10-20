"use client";

import { removeFile, uploadFile } from "@/lib/upload";
import { MAX_FILE_MB, type GoaFileKind } from "./types";
import { addTaskFiles } from "@/app/(With Sidebar)/goa/actions";

export const GOA_BUCKET = "goa-files";

export type UploadedFile = { path: string; name: string; mime: string; size: number };

/** Ambil File dari input (FormData.getAll) dan buang entri kosong. */
export const pickFiles = (values: FormDataEntryValue[]) => values.filter((v): v is File => v instanceof File && v.size > 0);

/** Upload ke `goa-files/{taskId}/...`; foto dikompres dulu. */
export async function uploadTaskFiles(taskId: string, files: File[]): Promise<UploadedFile[]> {
  const big = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024 && !f.type.startsWith("image/"));
  if (big) throw new Error(`${big.name} lebih dari ${MAX_FILE_MB} MB.`);
  const out: UploadedFile[] = [];
  try {
    for (const f of files) {
      const path = await uploadFile(GOA_BUCKET, taskId, f);
      const isImg = f.type.startsWith("image/");
      out.push({ path, name: isImg ? f.name.replace(/\.[^.]+$/, "") + ".webp" : f.name, mime: isImg ? "image/webp" : f.type || "application/octet-stream", size: f.size });
    }
  } catch (e) {
    await Promise.all(out.map((f) => removeFile(GOA_BUCKET, f.path)));
    throw e;
  }
  return out;
}

/** Upload + catat sebagai lampiran tugas. File storage dibuang lagi kalau pencatatan gagal. */
export async function attachTaskFiles(taskId: string, kind: GoaFileKind, files: File[]) {
  const uploaded = await uploadTaskFiles(taskId, files);
  const res = await addTaskFiles(taskId, kind, uploaded);
  if (!res.ok) await Promise.all(uploaded.map((f) => removeFile(GOA_BUCKET, f.path)));
  return res;
}
