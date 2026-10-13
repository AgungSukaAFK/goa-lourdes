import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

/** Tanggal hari ini (YYYY-MM-DD) menurut jam lokal device, bukan UTC. */
export const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** "Rp 150.000" */
export const formatCurrency = (value?: string | number | null): string => {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
};

/** "1.234" */
export const formatNumber = (value?: number | null, digits = 0): string =>
  value === null || value === undefined || Number.isNaN(value)
    ? "-"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);

/** "09 Okt 2026" */
export const formatDate = (date?: string | Date | null): string => {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
};

/** "09 Okt 2026, 14.30" */
export const formatDateTime = (date?: string | Date | null): string => {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
};
