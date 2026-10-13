import type { CompanyCode } from "@/lib/types";

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  brand: string | null;
  year: number | null;
  company: CompanyCode;
  site_id: string | null;
  odometer: number;
  service_interval_km: number;
  last_service_odo: number;
  tax_date: string | null;
  kir_date: string | null;
  plate_date: string | null;
  status: "available" | "in_use" | "grounded" | "maintenance" | "inactive";
  photo_path: string | null;
  notes: string | null;
};

export type Part = {
  id: string;
  name: string;
  type: "km" | "days";
  interval: number;
  cost: number;
  vehicle_ids: string[] | null;
  date_source: "tax_date" | "kir_date" | "plate_date" | null;
  is_active: boolean;
};

export type P2hItem = {
  id: string;
  target: "vehicle" | "driver";
  category: string;
  name: string;
  description: string | null;
  weight: number;
  is_critical: boolean;
  sort: number;
  is_active: boolean;
};

export type CostSettings = { fuelPrice: number; kmPerLiter: number; tollPerKm: number; poolLat: number; poolLng: number };

export const DEFAULT_COST: CostSettings = { fuelPrice: 15500, kmPerLiter: 8, tollPerKm: 1100, poolLat: -6.2349, poolLng: 106.9896 };

/** Estimasi biaya perjalanan pulang-pergi (rumus sistem lama, parameter bisa diatur). */
export function estimateTrip(distanceKm: number, c: CostSettings) {
  const d = Math.max(0, distanceKm);
  const liters = Math.ceil((d * 2) / c.kmPerLiter);
  const fuel = liters * c.fuelPrice;
  const toll = Math.ceil(d * c.tollPerKm);
  return { liters, fuel, toll, total: fuel + toll };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Sisa hari ke tanggal (negatif = lewat). */
export function daysUntil(date: string | null) {
  if (!date) return null;
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
  return Math.round((new Date(date).getTime() - today.getTime()) / 86400000);
}
