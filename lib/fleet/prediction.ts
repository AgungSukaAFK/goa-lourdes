import { daysUntil, type Part, type Vehicle } from "./types";

export type ServiceLog = { vehicle_id: string; part_id: string | null; odometer: number | null; serviced_at: string };
export type Usage = { vehicle_id: string; samples: number; avg_km_per_day: number | null };

export type Prediction = {
  vehicle: Vehicle;
  part: Part;
  dueDate: Date;
  daysLeft: number;
  /** khusus part km */
  targetKm?: number;
  remainingKm?: number;
  avgKmPerDay?: number;
  /** high: >= 5 catatan KM 90 hari; medium: 2-4; low: default 150 km/hari */
  confidence: "high" | "medium" | "low";
};

const DEFAULT_KM_PER_DAY = 150;
const DAY = 86400000;

function today() {
  return new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
}

/**
 * Prediksi servis berikutnya per kendaraan × part.
 * Peningkatan dari sistem lama: titik awal memakai riwayat servis nyata
 * (fleet_service_logs) bila ada, dan rata-rata km/hari dari log KM 90 hari
 * terakhir dengan tingkat keyakinan sesuai jumlah data.
 */
export function predict(vehicles: Vehicle[], parts: Part[], usage: Usage[], logs: ServiceLog[]): Prediction[] {
  const usageMap = new Map(usage.map((u) => [u.vehicle_id, u]));
  const out: Prediction[] = [];
  const t0 = today();

  for (const v of vehicles) {
    if (v.status === "inactive") continue;
    const u = usageMap.get(v.id);
    const avg = u?.avg_km_per_day && u.avg_km_per_day > 0 ? Number(u.avg_km_per_day) : DEFAULT_KM_PER_DAY;
    const confidence = !u?.avg_km_per_day ? "low" : u.samples >= 5 ? "high" : "medium";

    for (const p of parts) {
      if (!p.is_active) continue;
      if (p.vehicle_ids?.length && !p.vehicle_ids.includes(v.id)) continue;
      const last = logs
        .filter((l) => l.vehicle_id === v.id && l.part_id === p.id)
        .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0];

      if (p.type === "km") {
        const base = last?.odometer ?? Math.floor(v.odometer / p.interval) * p.interval;
        let target = base + p.interval;
        if (target <= v.odometer && !last) target += p.interval;
        const remaining = target - v.odometer;
        const days = Math.ceil(remaining / avg);
        out.push({
          vehicle: v,
          part: p,
          dueDate: new Date(t0.getTime() + Math.max(days, 0) * DAY),
          daysLeft: days,
          targetKm: target,
          remainingKm: remaining,
          avgKmPerDay: Math.round(avg),
          confidence,
        });
      } else {
        const docDate = p.date_source ? v[p.date_source] : null;
        let due: Date;
        if (docDate) {
          due = new Date(docDate);
        } else if (last) {
          due = new Date(new Date(last.serviced_at).getTime() + p.interval * DAY);
        } else continue;
        const d = daysUntil(due.toISOString().slice(0, 10)) ?? 0;
        out.push({ vehicle: v, part: p, dueDate: due, daysLeft: d, confidence: "high" });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Proyeksi 12 bulan ke depan: kejadian servis per bulan (untuk Prediksi Tahunan). */
export function annualPlan(vehicles: Vehicle[], parts: Part[], usage: Usage[], logs: ServiceLog[], months = 12) {
  const usageMap = new Map(usage.map((u) => [u.vehicle_id, u]));
  const t0 = today();
  const events: { month: string; vehicle: Vehicle; part: Part; targetKm?: number; cost: number; date: Date }[] = [];
  const horizon = new Date(t0.getFullYear(), t0.getMonth() + months, 1);

  for (const v of vehicles) {
    if (v.status === "inactive") continue;
    const avg = Number(usageMap.get(v.id)?.avg_km_per_day) || DEFAULT_KM_PER_DAY;
    for (const p of parts) {
      if (!p.is_active || (p.vehicle_ids?.length && !p.vehicle_ids.includes(v.id))) continue;
      const last = logs
        .filter((l) => l.vehicle_id === v.id && l.part_id === p.id)
        .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0];
      if (p.type === "km") {
        let target = (last?.odometer ?? Math.floor(v.odometer / p.interval) * p.interval) + p.interval;
        for (let i = 0; i < 24; i++) {
          const date = new Date(t0.getTime() + Math.max(0, Math.ceil((target - v.odometer) / avg)) * DAY);
          if (date >= horizon) break;
          events.push({ month: date.toISOString().slice(0, 7), vehicle: v, part: p, targetKm: target, cost: Number(p.cost), date });
          target += p.interval;
        }
      } else {
        const docDate = p.date_source ? v[p.date_source] : null;
        let date = docDate ? new Date(docDate) : last ? new Date(new Date(last.serviced_at).getTime() + p.interval * DAY) : null;
        if (!date) continue;
        while (date < t0) date = new Date(date.getTime() + p.interval * DAY);
        while (date < horizon) {
          events.push({ month: date.toISOString().slice(0, 7), vehicle: v, part: p, cost: Number(p.cost), date });
          date = new Date(date.getTime() + p.interval * DAY);
        }
      }
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
