import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Tujuan QR label: /asset/s/<kode aset> -> halaman detail. */
export default async function AssetShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireModule("asset");
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("id").eq("code", decodeURIComponent(code)).maybeSingle();
  if (!data) notFound();
  redirect(`/asset/assets/${data.id}`);
}
