import { notFound } from "next/navigation";
import { DocFooter, DocHeader, DocRows, Signatures } from "@/components/print/doc";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ASSET_REQUEST_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Formulir Peminjaman" };

export default async function LoanPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("asset");
  const { id } = await params;
  const supabase = await createClient();
  const { data: l } = await supabase.from("asset_loans_view").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();

  return (
    <article>
      <DocHeader company={l.company} title="Formulir Peminjaman Aset" number={l.code} />
      <DocRows
        rows={[
          ["Aset", `${l.asset_name} (${l.asset_code})`],
          ["Peminjam", `${l.borrower_name} — NRP ${l.borrower_nrp}${l.borrower_position ? `, ${l.borrower_position}` : ""}`],
          ["Tanggal pinjam", formatDate(l.borrow_date)],
          ["Rencana kembali", formatDate(l.expected_return_date)],
          ["Tujuan penggunaan", l.purpose ?? "-"],
          ["Status", ASSET_REQUEST_STATUS[l.status]?.label ?? l.status],
          ...(l.actual_return_date ? ([["Dikembalikan", formatDate(l.actual_return_date)]] as [string, string][]) : []),
        ]}
      />
      <p className="mt-6 text-sm leading-relaxed">
        Peminjam bertanggung jawab menjaga aset dalam kondisi baik dan mengembalikannya sesuai tanggal di atas. Kerusakan atau
        kehilangan selama masa pinjam menjadi tanggung jawab peminjam sesuai ketentuan perusahaan.
      </p>
      <Signatures
        items={[
          { role: "Peminjam", name: l.borrower_name },
          { role: "Disetujui GA", name: l.decided_by_name },
        ]}
      />
      <DocFooter />
    </article>
  );
}
