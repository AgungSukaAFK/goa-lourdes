import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { Content } from "@/components/content";
import { StatusBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { loadP2h, SIDE_LABEL } from "@/lib/fleet/p2h-detail";
import { FLEET_P2H_RESULT } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { P2hDetailActions } from "./p2h-detail-actions";

export const metadata: Metadata = { title: "Detail P2H" };

export default async function P2hDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await requireFleet(["admin", "driver"]);
  const data = await loadP2h(id);
  if (!data) notFound();
  const { p2h: p, answers, photos } = data;
  if (!s.isAdmin && p.driver_id !== s.myDriverId) notFound();

  const groups = new Map<string, typeof answers>();
  for (const a of answers) {
    const k = `${a.target === "driver" ? "Driver" : "Kendaraan"} · ${a.category}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  return (
    <>
      <Content title={`P2H ${p.code}`} description={formatDateTime(p.created_at)} cardAction={<P2hDetailActions id={p.id} code={p.code} canDelete={s.isAdmin} />}>
        <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-5xl font-semibold tabular-nums">{p.score}</p>
            <StatusBadge map={FLEET_P2H_RESULT} value={p.result} />
          </div>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Kendaraan", `${p.vehicle_plate} · ${p.vehicle_model}`],
                ["Driver", p.driver_name ? `${p.driver_name} (${p.driver_nrp})` : "-"],
                ["Jenis", p.kind === "weekly" ? "Rutin mingguan" : "Pra-perjalanan"],
                ["KM", formatNumber(p.odometer)],
                ["Booking", p.booking_id ? <Link key="b" href={`/fleet/bookings/${p.booking_id}`} className="text-primary hover:underline">{p.booking_code}</Link> : "-"],
                ["Pemeriksa", p.inspector_name ?? "-"],
                ["Diisi oleh", p.created_by_name ?? "-"],
                [
                  "Lokasi",
                  p.lat ? (
                    <a key="l" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </a>
                  ) : (
                    "-"
                  ),
                ],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {(p.issues ?? []).length > 0 && (
          <div className="mt-4 rounded-lg border bg-muted/50 p-3 text-sm dark:bg-muted/10">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Temuan & peringatan</p>
            <ul className="list-inside list-disc space-y-0.5">
              {(p.issues as string[]).map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        {p.notes && <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{p.notes}</p>}
      </Content>

      {photos.length > 0 && (
        <Content title="Foto">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((ph) => (
              <a key={ph.side} href={ph.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={`Foto ${SIDE_LABEL[ph.side]}`} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 text-xs">{SIDE_LABEL[ph.side]}</span>
              </a>
            ))}
          </div>
        </Content>
      )}

      {[...groups.entries()].map(([title, list]) => (
        <Content key={title} size="md" title={title}>
          <ul className="divide-y text-sm">
            {list.map((a) => (
              <li key={a.item_id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {a.name}
                  {a.critical && <span className="ml-1.5 text-[11px] text-muted-foreground">kritis</span>}
                </span>
                {a.ok ? (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300">
                    <Check className="size-4" /> Baik
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
                    <X className="size-4" /> Tidak
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Content>
      ))}
    </>
  );
}
