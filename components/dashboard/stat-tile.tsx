import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Angka utama + label, opsional link & catatan kecil. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  attention,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  /** Tandai perlu tindakan (titik oranye + label). */
  attention?: boolean;
}) {
  const span = "col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3";
  const body = (
    <Card className={cn("h-full gap-1 px-5 py-4", !href && span, href && "transition-colors hover:bg-accent/50")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {attention && <span className="size-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />}
          {hint}
        </p>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className={cn(span, "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    body
  );
}
