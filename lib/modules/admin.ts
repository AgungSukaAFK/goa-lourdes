import { Building2, IdCard, Megaphone, Settings, UserCog } from "lucide-react";
import type { NavGroup } from "./types";

/** Grup Admin: `roles` di sini = "moderator" atau "any-admin". */
export const adminGroup: NavGroup = {
  label: "Admin",
  items: [
    { title: "User Management", url: "/admin/users", icon: UserCog, roles: ["moderator"], keywords: ["user", "akun", "pengguna", "role", "hak akses", "aktivasi", "reset password"] },
    { title: "Karyawan", url: "/admin/employees", icon: IdCard, roles: ["any-admin"], keywords: ["karyawan", "pegawai", "nrp", "employee"] },
    { title: "Site", url: "/admin/sites", icon: Building2, roles: ["any-admin"], keywords: ["site", "lokasi", "cabang", "area"] },
    { title: "Pengumuman", url: "/admin/announcements", icon: Megaphone, roles: ["moderator"], keywords: ["broadcast", "pengumuman", "notifikasi"] },
    { title: "Pengaturan", url: "/admin/settings", icon: Settings, roles: ["moderator"], keywords: ["format kode", "kop", "pengaturan"] },
  ],
};
