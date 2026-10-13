import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";

export type P2hAnswer = { item_id: string; target: string; category: string; name: string; weight: number; critical: boolean; ok: boolean };

export async function loadP2h(id: string) {
  const supabase = await createClient();
  const [{ data: p }, { data: photos }] = await Promise.all([
    supabase.from("fleet_p2h_view").select("*").eq("id", id).maybeSingle(),
    supabase.from("fleet_p2h_photos").select("side, path").eq("inspection_id", id),
  ]);
  if (!p) return null;
  const urls = await signedUrls("p2h-photos", (photos ?? []).map((x) => x.path));
  const order = ["front", "back", "left", "right", "other"];
  return {
    p2h: p,
    // Driver dulu, baru kendaraan (urutan pengisian di form).
    answers: [...((p.answers ?? []) as P2hAnswer[])].sort((a, b) => (a.target === b.target ? 0 : a.target === "driver" ? -1 : 1)),
    photos: (photos ?? [])
      .sort((a, b) => order.indexOf(a.side) - order.indexOf(b.side))
      .map((x) => ({ side: x.side as string, url: urls[x.path] })),
  };
}

export const SIDE_LABEL: Record<string, string> = { front: "Depan", back: "Belakang", left: "Kiri", right: "Kanan", other: "Lainnya" };
