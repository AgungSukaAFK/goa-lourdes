import { notFound } from "next/navigation";
import { DocFooter, DocHeader, DocRows, Signatures } from "@/components/print/doc";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ASSET_REQUEST_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Berita Acara Mutasi" };

export default async function MutationPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("asset");
  const { id } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase.from("asset_mutations_view").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const person = (name: string | null, nrp: string | null, pos: string | null, site: string | null) =>
    name ? `${name} — NRP ${nrp}${pos ? `, ${pos}` : ""}${site ? ` (${site})` : ""}` : "-";

  return (
    <article>
      <DocHeader company={m.company} title="Berita Acara Serah Terima / Mutasi" number={m.code} />
      <p className="mb-4 text-sm">Pada tanggal {formatDate(m.decided_at ?? m.created_at)} telah dilakukan serah terima aset berikut:</p>
      <DocRows
        rows={[
          ["Aset", `${m.asset_name} (${m.asset_code})`],
          ["Pihak pertama (menyerahkan)", person(m.from_name, m.from_nrp, m.from_position, m.from_site_name)],
          ["Pihak kedua (menerima)", person(m.to_name, m.to_nrp, m.to_position, m.to_site_name)],
          ["Alasan", m.reason ?? "-"],
          ["Status", ASSET_REQUEST_STATUS[m.status]?.label ?? m.status],
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed">
        Pihak kedua telah memeriksa kondisi fisik aset dan menerimanya dalam keadaan baik. Sejak tanggal tersebut tanggung jawab
        atas aset beralih kepada pihak kedua.
      </p>
      <Signatures
        items={[
          { role: "Pihak Pertama", name: m.from_name },
          { role: "Pihak Kedua", name: m.to_name },
          { role: "Mengetahui GA", name: m.decided_by_name },
        ]}
      />
      <DocFooter />
    </article>
  );
}
