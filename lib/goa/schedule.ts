// Dipakai server & client - jangan beri "use client".

export const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function describeSchedule(t: { frequency: string; days: number[]; due_time: string; skip_holidays: boolean }) {
  const time = t.due_time.slice(0, 5);
  const base =
    t.frequency === "daily"
      ? "Setiap hari"
      : t.frequency === "weekly"
        ? t.days.length === 5 && [1, 2, 3, 4, 5].every((d) => t.days.includes(d))
          ? "Senin–Jumat"
          : t.days.map((d) => DOW[d]).join(", ")
        : `Tanggal ${t.days.join(", ")}`;
  return `${base} · batas ${time}${t.skip_holidays ? " · libur dilewati" : ""}`;
}
