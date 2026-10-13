"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeAuthed } from "@/lib/supabase/realtime";

const RouteMap = dynamic(() => import("@/components/map/route-map"), { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> });

/** Rute perjalanan; saat berjalan, titik baru masuk lewat Realtime. */
export function LiveRoute({
  bookingId,
  initial,
  destination,
  pool,
  live,
  label,
}: {
  bookingId: string;
  initial: [number, number][];
  destination: [number, number] | null;
  pool: [number, number];
  live: boolean;
  label: string;
}) {
  const [route, setRoute] = useState(initial);

  useEffect(() => {
    if (!live) return;
    return subscribeAuthed(`trip-${bookingId}`, (ch) =>
      ch.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fleet_trip_points", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const p = payload.new as { lat: number; lng: number };
          setRoute((r) => [...r, [p.lat, p.lng]]);
        },
      ),
    );
  }, [bookingId, live]);

  const pos = route.at(-1);
  return (
    <RouteMap
      center={pos ?? destination ?? pool}
      route={route}
      destination={destination}
      vehicles={pos && live ? [{ id: bookingId, lat: pos[0], lng: pos[1], label }] : []}
    />
  );
}
