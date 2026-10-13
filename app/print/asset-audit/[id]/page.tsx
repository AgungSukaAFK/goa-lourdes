import { notFound } from "next/navigation";
import { DocFooter, DocHeader, DocRows, Signatures } from "@/components/print/doc";
import { requireModule } from "@/lib/auth/session";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { ASSET_STATUS } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Laporan Audit" };

export default async function AuditPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("asset");
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("asset_audits_view").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const photo = await signedUrl("audit-photos", a.photo_path);

  return (
    <article>
      <DocHeader company={a.company} title="Laporan Audit Aset" number={a.code} />
      <DocRows
        rows={[
          ["Aset", `${a.asset_name} (${a.asset_code})`],
          ["Site", a.site_name ?? "-"],
          ["Pemegang", a.owner_name ?? "-"],
          ["Jatuh tempo", formatDate(a.due_date)],
          ["Diperiksa", a.realized_at ? `${formatDateTime(a.realized_at)} oleh ${a.realized_by_name ?? "-"}` : "Belum"],
          ["Kondisi ditemukan", a.found_condition ? (ASSET_STATUS[a.found_condition]?.label ?? a.found_condition) : "-"],
          ["Catatan", a.notes ?? "-"],
        ]}
      />
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Foto bukti audit" className="mt-6 max-h-[90mm] rounded border border-black object-contain" />
      )}
      <Signatures items={[{ role: "Petugas Audit", name: a.realized_by_name }, { role: "Pemegang Aset", name: a.owner_name }]} />
      <DocFooter />
    </article>
  );
}
