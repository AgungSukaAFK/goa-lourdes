"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Jalankan server action dengan toast sukses/gagal + router.refresh().
 * `run` mengembalikan true kalau berhasil.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = <T,>(
    action: () => Promise<ActionResult<T>>,
    opts: { success?: string; refresh?: boolean; onSuccess?: (data?: T) => void } = {},
  ) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        try {
          const res = await action();
          if (res.ok) {
            toast.success(res.message ?? opts.success ?? "Berhasil disimpan.");
            if (opts.refresh !== false) router.refresh();
            opts.onSuccess?.(res.data);
            resolve(true);
          } else {
            toast.error(res.error);
            resolve(false);
          }
        } catch {
          toast.error("Terjadi kesalahan. Coba lagi.");
          resolve(false);
        }
      });
    });

  return { run, pending };
}
