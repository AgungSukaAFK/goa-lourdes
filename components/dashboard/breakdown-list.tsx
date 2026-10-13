import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { StatusMap } from "@/lib/status";
import { formatNumber } from "@/lib/utils";

/** Komposisi status: badge berlabel + jumlah + bar tipis (bukan pie). */
export function StatusBreakdown({
  map,
  counts,
  hrefFor,
}: {
  map: StatusMap;
  counts: Record<string, number>;
  hrefFor?: (status: string) => string;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const keys = Object.keys(map).filter((k) => counts[k]);
  if (!keys.length) return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>;

  return (
    <ul className="space-y-3">
      {keys.map((k) => {
        const n = counts[k] ?? 0;
        const pct = Math.round((n / total) * 100);
        const row = (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <StatusBadge map={map} value={k} />
              <span className="tabular-nums">
                {formatNumber(n)} <span className="text-xs text-muted-foreground">({pct}%)</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/40" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={k}>
            {hrefFor ? (
              <Link href={hrefFor(k)} className="block rounded-md p-1 -m-1 hover:bg-accent/50">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
