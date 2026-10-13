// Analisis beban kerja (WLA): jam kerja tercatat vs kapasitas hari kerja.
// Berbeda dari GOA 5.5 (total jam semua waktu ÷ 22 hari, sehingga utilisasi
// terus naik seiring data bertambah), di sini dihitung per periode yang dipilih
// dengan hari kerja sebenarnya.

export const HOURS_PER_DAY = 8;
/** Durasi satu tugas dibatasi 1 hari kerja supaya tugas yang lupa ditutup tidak menggelembungkan jam. */
export const MAX_TASK_MINUTES = HOURS_PER_DAY * 60;

export type WorkloadPeriod = "week" | "month";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Rentang [start, end) dalam tanggal WIB "YYYY-MM-DD" + jumlah hari kerja (Senin–Jumat, di luar libur). */
export function workloadRange(period: WorkloadPeriod, refDate: string, holidays: Set<string>) {
  const ref = new Date(`${refDate}T00:00:00Z`);
  const start = new Date(ref);
  const end = new Date(ref);
  if (period === "week") {
    start.setUTCDate(ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(start.getUTCDate() + 7);
  } else {
    start.setUTCDate(1);
    end.setTime(start.getTime());
    end.setUTCMonth(start.getUTCMonth() + 1);
  }
  let workdays = 0;
  for (const d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !holidays.has(iso(d))) workdays++;
  }
  const last = new Date(end.getTime() - 86400000);
  return { start: iso(start), end: iso(end), last: iso(last), workdays, capacityHours: workdays * HOURS_PER_DAY };
}

export type WorkloadStatus = "over" | "ideal" | "under" | "none";

export const WORKLOAD_STATUS = {
  over: { label: "Kurang manpower", tone: "red" },
  ideal: { label: "Ideal", tone: "green" },
  under: { label: "Lebih manpower", tone: "amber" },
  none: { label: "Belum ada data", tone: "gray" },
} as const;

/** >100% kapasitas: kurang manpower; 80–100%: ideal; <80%: lebih manpower (sama dengan GOA 5.5). */
export function workloadStatus(utilization: number | null): WorkloadStatus {
  if (utilization === null) return "none";
  if (utilization > 100) return "over";
  if (utilization >= 80) return "ideal";
  return "under";
}

export function summarizeWorkload(
  tasks: { duration_minutes: number | null }[],
  capacityHours: number,
  workdays: number,
) {
  let minutes = 0;
  let capped = 0;
  let counted = 0;
  for (const t of tasks) {
    const m = t.duration_minutes ?? 0;
    if (m <= 0) continue;
    counted++;
    if (m > MAX_TASK_MINUTES) capped++;
    minutes += Math.min(m, MAX_TASK_MINUTES);
  }
  const hours = minutes / 60;
  const utilization = counted && capacityHours ? Math.round((hours / capacityHours) * 100) : null;
  return {
    tasks: tasks.length,
    counted,
    capped,
    hours,
    perDay: workdays ? hours / workdays : 0,
    utilization,
    status: workloadStatus(utilization),
  };
}
