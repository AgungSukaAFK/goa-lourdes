import type { Metadata } from "next";
import { Content } from "@/components/content";
import { requireModerator } from "@/lib/auth/session";
import { getCodeFormats } from "@/lib/asset/server";
import { createClient } from "@/lib/supabase/server";
import { CodeFormatForm } from "./code-format-form";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  await requireModerator();
  const formats = await getCodeFormats(await createClient());
  return (
    <Content title="Format kode aset" description="Dipakai saat registrasi aset baru tanpa kode manual. Aset lama tidak berubah.">
      <CodeFormatForm initial={formats} />
    </Content>
  );
}
