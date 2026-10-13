"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatNumber } from "@/lib/utils";

/** Garis satu seri dari waktu ke waktu (tanpa legenda; judul card menamai seri). */
export function TimeLineChart({ data, label, height = 220 }: { data: { date: string; value: number }[]; label: string; height?: number }) {
  const config = { value: { label, color: "var(--color-primary)" } } satisfies ChartConfig;
  if (data.length < 2) return <p className="py-8 text-center text-sm text-muted-foreground">Data belum cukup untuk grafik.</p>;
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
        />
        <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} domain={["dataMin", "dataMax"]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => new Date(p?.[0]?.payload?.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
              formatter={(v) => `${formatNumber(Number(v))} km`}
            />
          }
        />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ChartContainer>
  );
}
