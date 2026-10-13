// Warna badge status (styling guide §6). Tulis string class lengkap supaya
// Tailwind bisa membacanya; jangan dirangkai dinamis.

export const TONES = {
  gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
} as const;

export type Tone = keyof typeof TONES;

export type StatusDef = { label: string; tone: Tone };
export type StatusMap = Record<string, StatusDef>;

export const ACCOUNT_STATUS: StatusMap = {
  active: { label: "Aktif", tone: "green" },
  inactive: { label: "Nonaktif", tone: "gray" },
  incomplete: { label: "Perlu dilengkapi", tone: "amber" },
};

export const COMPANY_TONE: Record<string, Tone> = {
  GMI: "indigo",
  GIS: "emerald",
  LOURDES: "gray",
};

// ---------------------------------------------------------------- Asset
export const ASSET_STATUS: StatusMap = {
  ready: { label: "Ready", tone: "green" },
  loaned: { label: "Dipinjam", tone: "amber" },
  damaged: { label: "Rusak", tone: "red" },
  lost: { label: "Hilang", tone: "orange" },
  disposed: { label: "Disposal", tone: "gray" },
};

export const ASSET_REQUEST_STATUS: StatusMap = {
  pending: { label: "Menunggu GA", tone: "blue" },
  approved: { label: "Disetujui", tone: "green" },
  rejected: { label: "Ditolak", tone: "red" },
  returned: { label: "Dikembalikan", tone: "emerald" },
  overdue: { label: "Terlambat", tone: "orange" },
};

export const ASSET_AUDIT_STATUS: StatusMap = {
  waiting: { label: "Menunggu cek", tone: "blue" },
  fulfilled: { label: "Selesai", tone: "emerald" },
  overdue: { label: "Lewat jatuh tempo", tone: "orange" },
};

// ---------------------------------------------------------------- Fleet
export const FLEET_VEHICLE_STATUS: StatusMap = {
  available: { label: "Tersedia", tone: "green" },
  in_use: { label: "Dipakai", tone: "blue" },
  grounded: { label: "Tidak layak", tone: "red" },
  maintenance: { label: "Perawatan", tone: "orange" },
  inactive: { label: "Nonaktif", tone: "gray" },
};

export const FLEET_BOOKING_STATUS: StatusMap = {
  pending: { label: "Menunggu GA", tone: "blue" },
  approved: { label: "Disetujui", tone: "sky" },
  in_use: { label: "Dalam perjalanan", tone: "indigo" },
  completed: { label: "Selesai", tone: "emerald" },
  rejected: { label: "Ditolak", tone: "red" },
  cancelled: { label: "Dibatalkan", tone: "gray" },
};

export const FLEET_P2H_RESULT: StatusMap = {
  fit: { label: "Layak", tone: "green" },
  caution: { label: "Layak dg catatan", tone: "amber" },
  grounded: { label: "Tidak layak", tone: "red" },
};

export const FLEET_REPAIR_STATUS: StatusMap = {
  queued: { label: "Antrean", tone: "gray" },
  in_progress: { label: "Dikerjakan", tone: "blue" },
  done: { label: "Selesai", tone: "emerald" },
  cancelled: { label: "Dibatalkan", tone: "gray" },
};

export const FLEET_FUEL_RATING: StatusMap = {
  very_efficient: { label: "Sangat irit", tone: "emerald" },
  efficient: { label: "Irit", tone: "green" },
  fair: { label: "Cukup", tone: "amber" },
  wasteful: { label: "Boros", tone: "red" },
};

// ---------------------------------------------------------------- GOA
export const GOA_TASK_STATUS: StatusMap = {
  pending: { label: "Pending", tone: "gray" },
  in_progress: { label: "Dikerjakan", tone: "blue" },
  done: { label: "Selesai", tone: "emerald" },
  undone: { label: "Tidak selesai", tone: "red" },
  expired: { label: "Hangus", tone: "orange" },
  overdue: { label: "Lewat batas", tone: "amber" },
};

export const GOA_PRESENCE: StatusMap = {
  hadir: { label: "Hadir", tone: "green" },
  cuti: { label: "Cuti", tone: "sky" },
  sakit: { label: "Sakit", tone: "amber" },
  izin: { label: "Izin", tone: "gray" },
  dinas: { label: "Dinas luar", tone: "indigo" },
};

export const GOA_SP: StatusMap = {
  none: { label: "Tidak ada SP", tone: "gray" },
  sp1: { label: "SP 1", tone: "amber" },
  sp2: { label: "SP 2", tone: "orange" },
  sp3: { label: "SP 3", tone: "red" },
};
