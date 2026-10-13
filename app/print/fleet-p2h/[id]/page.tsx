import { notFound } from "next/navigation";
import { DocFooter, DocHeader, DocRows, Signatures } from "@/components/print/doc";
import { requireModule } from "@/lib/auth/session";
import { loadP2h, SIDE_LABEL } from "@/lib/fleet/p2h-detail";
import { FLEET_P2H_RESULT } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Cetak P2H" };

export default async function P2hPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("fleet", ["admin", "driver"]);
  const data = await loadP2h((await params).id);
  if (!data) notFound();
  const { p2h: p, answers, photos } = data;
  return (
    <article className="text-sm">
      <DocHeader company={p.company} title="Pemeriksaan Harian Kendaraan (P2H)" number={p.code} />
      <DocRows
        rows={[
          ["Kendaraan", `${p.vehicle_plate} · ${p.vehicle_model}`],
          ["Driver", p.driver_name ?? "-"],
          ["Waktu", formatDateTime(p.created_at)],
          ["KM", formatNumber(p.odometer)],
          ["Skor / hasil", `${p.score} · ${FLEET_P2H_RESULT[p.result]?.label}`],
        ]}
      />
      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-1.5 py-1 text-left">Item</th>
            <th className="w-20 border border-black px-1.5 py-1">Hasil</th>
          </tr>
        </thead>
        <tbody>
          {answers.map((a) => (
            <tr key={a.item_id}>
              <td className="border border-black px-1.5 py-0.5">
                <span className="text-neutral-500">{a.category} · </span>
                {a.name}
                {a.critical ? " *" : ""}
              </td>
              <td className="border border-black px-1.5 py-0.5 text-center">{a.ok ? "Baik" : "TIDAK"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-neutral-500">* item kritis: gagal = tidak layak jalan</p>
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2 break-inside-avoid">
          {photos.map((ph) => (
            <figure key={ph.side}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt={SIDE_LABEL[ph.side]} className="aspect-[4/3] w-full border border-black object-cover" />
              <figcaption className="text-center text-[10px]">{SIDE_LABEL[ph.side]}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <Signatures items={[{ role: "Driver", name: p.driver_name }, { role: "Pemeriksa", name: p.inspector_name }]} />
      <DocFooter />
    </article>
  );
}
