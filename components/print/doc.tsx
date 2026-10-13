import Image from "next/image";
import { COMPANY_LABELS, type CompanyCode } from "@/lib/types";

// Dokumen cetak sengaja hitam-putih (bukan token tema) supaya hasil print sama
// di semua mode tampilan.

export function DocHeader({ company, title, number }: { company: CompanyCode; title: string; number: string }) {
  return (
    <header className="mb-6 flex items-center gap-4 border-b-2 border-black pb-3">
      <Image src={company === "GIS" ? "/gis-logo.webp" : "/gmi-logo.webp"} alt={company} width={56} height={56} className="size-14 object-contain" />
      <div className="flex-1">
        <p className="text-base font-semibold">{COMPANY_LABELS[company]}</p>
        <p className="text-xs">General Affairs · Lourdes Group</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold uppercase">{title}</p>
        <p className="font-mono text-xs">{number}</p>
      </div>
    </header>
  );
}

export function DocRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="align-top">
            <td className="w-48 py-1 pr-2 text-neutral-600">{k}</td>
            <td className="py-1">: {v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Signatures({ items }: { items: { role: string; name?: string | null }[] }) {
  return (
    <div className="mt-12 grid gap-6 text-center text-sm" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.role}>
          <p>{s.role}</p>
          <div className="h-20" />
          <p className="border-t border-black pt-1 font-medium">{s.name || "(.................................)"}</p>
        </div>
      ))}
    </div>
  );
}

export function DocFooter() {
  return (
    <p className="mt-10 text-[10px] text-neutral-500">
      Dicetak dari GOA HZ pada{" "}
      {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB
    </p>
  );
}
