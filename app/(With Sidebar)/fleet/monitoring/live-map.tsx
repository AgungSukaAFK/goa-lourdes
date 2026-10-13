"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeAuthed } from "@/lib/supabase/realtime";
import { cn, formatDateTime } from "@/lib/utils";

const RouteMap = dynamic(() => import("@/components/map/route-map"), { ssr: false, loading: () => <Skeleton className="h-[32rem] w-full" /> });

export type Trip = {
  id: string;
  code: string;
  plate: string;
  driver: string | null;
  destination: string | null;
  lat: number | null;
  lng: number | null;
  seen: string | null;
};

const STALE_MS = 5 * 60 * 1000;

export function LiveMap({ trips: initial, pool }: { trips: Trip[]; pool: [number, number] }) {
  const [trips, setTrips] = useState(initial);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const ids = new Set(initial.map((t) => t.id));
    const unsub = subscribeAuthed("fleet-monitoring", (ch) =>
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "fleet_trip_points" }, (payload) => {
        const p = payload.new as { booking_id: string; lat: number; lng: number; recorded_at: string };
        if (!ids.has(p.booking_id)) return;
        setTrips((ts) => ts.map((t) => (t.id === p.booking_id ? { ...t, lat: p.lat, lng: p.lng, seen: p.recorded_at } : t)));
      }),
    );
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [initial]);

  const located = trips.filter((t) => t.lat !== null && t.lng !== null);
  const stale = (t: Trip) => !t.seen || now - new Date(t.seen).getTime() > STALE_MS;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <RouteMap
        center={pool}
        height="h-[32rem]"
        vehicles={located.map((t) => ({ id: t.id, lat: t.lat!, lng: t.lng!, label: t.plate, sub: t.driver ?? undefined, stale: stale(t) }))}
      />
      <ul className="space-y-2">
        {trips.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Tidak ada perjalanan berjalan.</li>}
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/fleet/bookings/${t.id}`} className="block rounded-lg border p-3 text-sm transition-colors hover:bg-accent">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-medium">{t.plate}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs", stale(t) ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300")}>
                  <Radio className="size-3.5" />
                  {stale(t) ? "Sinyal hilang" : "Live"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{t.driver ?? "-"} · {t.destination ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Update: {t.seen ? formatDateTime(t.seen) : "belum ada"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
