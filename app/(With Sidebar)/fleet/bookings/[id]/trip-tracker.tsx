"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LocateFixed, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haversineKm } from "@/lib/fleet/types";

const MIN_INTERVAL_MS = 15000;
const MIN_DISTANCE_KM = 0.05;

/**
 * Kirim posisi driver selama perjalanan: tiap 15 dtk atau pindah > 50 m.
 * Browser menghentikan GPS saat layar mati / app di background, jadi layar
 * dijaga tetap menyala (Wake Lock) dan ada peringatan kalau sinyal putus.
 */
export function TripTracker({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<"starting" | "ok" | "denied" | "error">("starting");
  const [sent, setSent] = useState(0);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const last = useRef<{ lat: number; lng: number; t: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState("error");
      return;
    }
    const supabase = createClient();
    let wake: WakeLockSentinel | null = null;
    const lockScreen = async () => {
      try {
        wake = await navigator.wakeLock?.request("screen");
      } catch {
        // tidak didukung / ditolak - lanjut tanpa wake lock
      }
    };
    lockScreen();
    const onVisible = () => document.visibilityState === "visible" && lockScreen();
    document.addEventListener("visibilitychange", onVisible);

    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        setState("ok");
        const { latitude: lat, longitude: lng, speed, accuracy, heading } = pos.coords;
        const t = Date.now();
        const prev = last.current;
        if (prev && t - prev.t < MIN_INTERVAL_MS && haversineKm(prev.lat, prev.lng, lat, lng) < MIN_DISTANCE_KM) return;
        last.current = { lat, lng, t };
        const { error } = await supabase.from("fleet_trip_points").insert({
          booking_id: bookingId,
          lat,
          lng,
          speed: speed !== null ? speed * 3.6 : null,
          accuracy,
          heading,
        });
        if (!error) {
          await supabase.from("fleet_bookings").update({ last_lat: lat, last_lng: lng, last_seen_at: new Date().toISOString() }).eq("id", bookingId);
          setSent((n) => n + 1);
          setLastAt(t);
        }
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      wake?.release().catch(() => {});
    };
  }, [bookingId]);

  const stale = lastAt !== null && now - lastAt > 120000;

  if (state === "denied" || state === "error") {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {state === "denied"
          ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini supaya perjalanan bisa dipantau."
          : "GPS tidak tersedia di perangkat ini."}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/50 p-3 text-sm dark:bg-muted/10">
      <span className="inline-flex items-center gap-2 font-medium">
        {state === "starting" ? <LocateFixed className="size-4 animate-pulse text-muted-foreground" /> : <Radio className="size-4 text-primary" />}
        {state === "starting" ? "Mencari sinyal GPS..." : "GPS aktif"}
      </span>
      <span className="text-muted-foreground">{sent} titik terkirim</span>
      {stale && (
        <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-300">
          <AlertTriangle className="size-3.5" /> Lebih dari 2 menit tanpa update. Jangan kunci layar.
        </span>
      )}
    </div>
  );
}
