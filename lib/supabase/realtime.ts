"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "./client";

/**
 * Buat channel Realtime setelah token sesi terpasang. Tanpa ini koneksi
 * Realtime bisa terbuka sebagai `anon` (sesi dari cookie belum termuat) dan
 * RLS membuang semua event. Mengembalikan fungsi untuk menutup channel.
 */
export function subscribeAuthed(name: string, setup: (ch: RealtimeChannel) => RealtimeChannel) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let closed = false;
  (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (closed) return;
    channel = setup(supabase.channel(name)).subscribe();
  })();
  const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
    if (session) supabase.realtime.setAuth(session.access_token);
  });
  return () => {
    closed = true;
    sub.subscription.unsubscribe();
    if (channel) supabase.removeChannel(channel);
  };
}
