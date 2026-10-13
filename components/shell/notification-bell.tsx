"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { subscribeAuthed } from "@/lib/supabase/realtime";
import { cn, formatDateTime } from "@/lib/utils";

type Notif = { id: string; title: string; body: string | null; link: string | null; created_at: string; read: boolean };

/** Lonceng notifikasi: personal + broadcast (sesuai RLS), realtime. */
export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    const [{ data }, { data: reads }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, link, created_at")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("notification_reads").select("notification_id").eq("user_id", userId),
    ]);
    const read = new Set((reads ?? []).map((r) => r.notification_id));
    setItems((data ?? []).map((n) => ({ ...n, read: read.has(n.id) })));
  }, [userId]);

  useEffect(() => {
    load();
    // Realtime ikut RLS: hanya notifikasi yang boleh dilihat user yang masuk.
    return subscribeAuthed(`notif-${userId}`, (ch) =>
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        toast.info((payload.new as { title: string }).title);
        load();
      }),
    );
  }, [userId, load]);

  const unread = items.filter((i) => !i.read).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)));
    await createClient()
      .from("notification_reads")
      .upsert(ids.map((notification_id) => ({ notification_id, user_id: userId })), { onConflict: "notification_id,user_id", ignoreDuplicates: true });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}>
          <Bell className="text-muted-foreground" size={16} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifikasi</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markRead(items.filter((i) => !i.read).map((i) => i.id))} disabled={!unread}>
            <CheckCheck />
            Tandai dibaca
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</li>}
          {items.map((n) => {
            const body = (
              <>
                <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </>
            );
            return (
              <li key={n.id} className="border-b last:border-0">
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => {
                      markRead([n.id]);
                      setOpen(false);
                    }}
                    className={cn("block px-3 py-2 hover:bg-accent", !n.read && "bg-primary/5")}
                  >
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead([n.id])} className={cn("block w-full px-3 py-2 text-left hover:bg-accent", !n.read && "bg-primary/5")}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
