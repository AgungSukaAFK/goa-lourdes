import { Badge } from "@/components/ui/badge";
import { TONES, type StatusMap, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Badge outline lembut dari map status (lib/status.ts). */
export function StatusBadge({
  map,
  value,
  className,
}: {
  map: StatusMap;
  value: string | null | undefined;
  className?: string;
}) {
  const def = (value && map[value]) || { label: value ?? "-", tone: "gray" as Tone };
  return (
    <Badge variant="outline" className={cn(TONES[def.tone], "whitespace-nowrap", className)}>
      {def.label}
    </Badge>
  );
}

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TONES[tone], "whitespace-nowrap", className)}>
      {children}
    </Badge>
  );
}
