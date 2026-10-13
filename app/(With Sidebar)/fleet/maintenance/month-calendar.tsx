"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

export type CalEvent = { date: string; plate: string; part: string; cost: number };

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Kalender bulanan jadwal servis prediksi (geser bulan di sisi klien). */
export function MonthCalendar({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayKey = today.toLocaleDateString("en-CA");
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const monthEvents = events.filter((e) => e.date.startsWith(key(1).slice(0, 7)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label="Bulan sebelumnya">
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-semibold">{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p>
          <p className="text-xs text-muted-foreground">
            {monthEvents.length} jadwal · {formatCurrency(monthEvents.reduce((a, e) => a + e.cost, 0))}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOffset((o) => o + 1)} aria-label="Bulan berikutnya">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: first }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const d = i + 1;
          const evs = byDay.get(key(d)) ?? [];
          return (
            <div
              key={d}
              className={cn(
                "min-h-16 rounded-md border p-1 sm:min-h-20",
                key(d) === todayKey && "border-primary",
                evs.length > 0 && "bg-muted/50 dark:bg-muted/10",
              )}
              title={evs.map((e) => `${e.plate}: ${e.part}`).join("\n")}
            >
              <p className={cn("text-[11px]", key(d) === todayKey ? "font-semibold text-primary" : "text-muted-foreground")}>{d}</p>
              <ul className="mt-0.5 space-y-0.5">
                {evs.slice(0, 2).map((e, j) => (
                  <li key={j} className="hidden truncate rounded bg-background px-1 text-[10px] leading-4 shadow-xs sm:block">
                    <span className="font-mono">{e.plate.split(" ").slice(0, 2).join(" ")}</span> {e.part}
                  </li>
                ))}
                {evs.length > 0 && (
                  <li className="text-[10px] text-muted-foreground sm:hidden">{evs.length}×</li>
                )}
                {evs.length > 2 && <li className="hidden text-[10px] text-muted-foreground sm:block">+{evs.length - 2} lagi</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
