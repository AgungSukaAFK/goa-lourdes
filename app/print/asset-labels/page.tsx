import { notFound } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Label Aset" };

export default async function AssetLabels({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireModule("asset");
  const ids = ((await searchParams).ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300);
  if (!ids.length) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("assets_view").select("id, code, name, company, owner_name, site_name").in("id", ids).order("code");
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="grid grid-cols-3 gap-2 print:gap-1.5">
      {(data ?? []).map((a) => (
        <div key={a.id} className="flex break-inside-avoid items-center gap-2 rounded border border-black p-2">
          <QRCodeSVG value={`${app}/asset/s/${encodeURIComponent(a.code)}`} size={64} level="M" />
          <div className="min-w-0 text-[9px] leading-tight">
            <p className="text-[8px] font-semibold uppercase">Lourdes Group · {a.company}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold">{a.name}</p>
            <p className="mt-0.5 break-all font-mono">{a.code}</p>
            {a.owner_name && <p className="mt-0.5 truncate">PIC: {a.owner_name}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
