import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { Insight } from "@/lib/goa/kpi";

const ICON = { good: CircleCheck, warn: TriangleAlert, bad: CircleAlert };
const COLOR = { good: "text-green-700 dark:text-green-300", warn: "text-amber-700 dark:text-amber-300", bad: "text-red-700 dark:text-red-300" };
const LABEL = { good: "Baik", warn: "Perhatian", bad: "Perlu perbaikan" };

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => {
        const Icon = ICON[it.tone];
        return (
          <li key={i} className="flex gap-2.5">
            <Icon className={`mt-0.5 size-4 shrink-0 ${COLOR[it.tone]}`} aria-label={LABEL[it.tone]} />
            <div>
              <p className="text-sm font-medium">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
