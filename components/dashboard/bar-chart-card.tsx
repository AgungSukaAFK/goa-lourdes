"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatNumber, formatRupiahShort } from "@/lib/utils";

/**
 * Bar horizontal satu seri (magnitudo per kategori). Satu warna (primary),
 * tanpa legenda - judul card yang menamai serinya. Tooltip saat hover.
 */
export function HorizontalBarChart({
  data,
  label,
  format = "number",
}: {
  data: { name: string; value: number }[];
  label: string;
  /** String (bukan fungsi) supaya bisa dioper dari Server Component. */
  format?: "number" | "rupiah";
}) {
  const valueFormatter = (v: number) => (format === "rupiah" ? formatRupiahShort(v) : formatNumber(v));
  const config = { value: { label, color: "var(--color-primary)" } } satisfies ChartConfig;
  const height = Math.max(80, data.length * 34 + 16);
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>;

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40, top: 0, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
          content={<ChartTooltipContent hideIndicator formatter={(v) => valueFormatter(Number(v))} />}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{ position: "right", fontSize: 11, fill: "var(--color-muted-foreground)", formatter: (v: number) => valueFormatter(v) }}
        />
      </BarChart>
    </ChartContainer>
  );
}
