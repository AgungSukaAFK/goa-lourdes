import { ToneBadge } from "@/components/status-badge";
import { daysUntil } from "@/lib/fleet/types";
import { formatDate } from "@/lib/utils";

/** Tanggal jatuh tempo + badge "lewat" / "x hari" kalau <= 30 hari. */
export function DocDue({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">-</span>;
  const d = daysUntil(date)!;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
      {formatDate(date)}
      {d < 0 ? (
        <ToneBadge tone="red" className="text-[10px]">Lewat {Math.abs(d)} hr</ToneBadge>
      ) : d <= 30 ? (
        <ToneBadge tone="amber" className="text-[10px]">{d} hr lagi</ToneBadge>
      ) : null}
    </span>
  );
}
