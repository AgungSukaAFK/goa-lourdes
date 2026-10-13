import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAssetCode, DEFAULT_CODE_FORMAT } from "./code";
import type { CompanyCode } from "@/lib/types";

export async function getCodeFormats(supabase: SupabaseClient) {
  const { data } = await supabase.from("app_settings").select("company, value").eq("key", "asset_code_format");
  const out: Record<CompanyCode, string> = { ...DEFAULT_CODE_FORMAT };
  for (const r of data ?? []) if (r.company === "GMI" || r.company === "GIS") out[r.company as CompanyCode] = String(r.value);
  return out;
}

/** Kode aset berikutnya (nomor urut per PT, atomik di DB). */
export async function generateAssetCode(
  supabase: SupabaseClient,
  formats: Record<CompanyCode, string>,
  a: Parameters<typeof buildAssetCode>[1] & { company: CompanyCode },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: num, error } = await supabase.rpc("next_counter", { p_key: `asset:${a.company}` });
    if (error) throw error;
    const code = buildAssetCode(formats[a.company], a, num as number);
    const { data: taken } = await supabase.from("assets").select("id").eq("code", code).maybeSingle();
    if (!taken) return code;
  }
  throw new Error("Gagal membuat kode aset unik.");
}
