import type { MenuPermissions } from "@/lib/types";

/** Menu Asset yang hak aksesnya bisa diatur per user (role Staff). */
export const ASSET_PERMISSION_MENUS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "assets", label: "Daftar Aset & Scan" },
  { key: "loans", label: "Peminjaman" },
  { key: "mutations", label: "Mutasi" },
  { key: "audits", label: "Audit" },
  { key: "config", label: "Kategori & Log" },
  { key: "sop", label: "SOP" },
] as const;

export const ASSET_ACTIONS = [
  { key: "read", label: "Lihat" },
  { key: "write", label: "Tulis" },
  { key: "delete", label: "Hapus" },
] as const;

/** Default Staff: lihat semua, ajukan pinjam/mutasi. */
export const DEFAULT_STAFF_PERMISSIONS: MenuPermissions = {
  dashboard: { read: true },
  assets: { read: true },
  loans: { read: true, write: true },
  mutations: { read: true, write: true },
  audits: { read: true },
  config: {},
  sop: { read: true },
};
