import type { Metadata } from "next";
import { Content } from "@/components/content";
import { requireGoa } from "@/lib/goa/guard";
import { loadCategories, loadKpiSettings, loadTeam } from "@/lib/goa/server";
import { createClient } from "@/lib/supabase/server";
import { CategoryEditor, HolidayEditor, KpiEditor } from "./settings-client";

export const metadata: Metadata = { title: "Pengaturan KPI" };

export default async function GoaSettings() {
  await requireGoa(["supervisor"]);
  const supabase = await createClient();
  const [settings, team, categories, { data: holidays }] = await Promise.all([
    loadKpiSettings(),
    loadTeam(null),
    loadCategories(),
    supabase.from("holidays").select("date, name").gte("date", new Date().toISOString().slice(0, 4) + "-01-01").order("date"),
  ]);
  return (
    <>
      <Content title="Bobot KPI" description="Skor KPI = rata-rata berbobot parameter yang dipilih, dikurangi penalti SP. Bisa diatur global atau khusus per anggota.">
        <KpiEditor settings={settings} members={team.filter((m) => m.role !== "guest").map((m) => ({ value: m.id, label: m.name }))} />
      </Content>
      <Content size="md" title="Kategori pekerjaan">
        <CategoryEditor categories={categories} />
      </Content>
      <Content size="md" title="Hari libur" description="Template rutin dengan 'lewati hari libur' tidak membuat tugas di tanggal ini.">
        <HolidayEditor holidays={holidays ?? []} />
      </Content>
    </>
  );
}
