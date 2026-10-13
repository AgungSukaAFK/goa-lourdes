import { kpiGrade } from "@/lib/goa/kpi";
import { cn } from "@/lib/utils";

/** Skor KPI 0-100 + grade + bar tipis. Warna teks netral; bar memakai primary. */
export function KpiScore({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className={cn("flex items-center gap-2", size === "lg" && "flex-col items-start gap-1")}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-4xl" : "text-sm")}>
        {score}
        <span className={cn("ml-1 font-medium text-muted-foreground", size === "lg" ? "text-lg" : "text-xs")}>{kpiGrade(score)}</span>
      </span>
      <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", size === "lg" ? "w-32" : "w-16")}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
