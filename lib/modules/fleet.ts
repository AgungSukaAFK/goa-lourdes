import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  CarFront,
  ClipboardCheck,
  ClipboardList,
  Fuel,
  History,
  LayoutDashboard,
  MapPinned,
  Settings2,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { ModuleConfig } from "./types";

const ADMIN = ["admin"];

export const fleetModule: ModuleConfig = {
  id: "fleet",
  name: "Fleet",
  description: "Armada, booking & P2H",
  icon: Truck,
  basePath: "/fleet",
  keywords: ["fleet", "armada", "kendaraan", "mobil", "unit"],
  groups: [
    {
      label: "Operasional",
      items: [
        { title: "Dashboard", url: "/fleet", icon: LayoutDashboard, roles: ADMIN, keywords: ["beranda", "ringkasan"] },
        { title: "Booking Unit", url: "/fleet/bookings", icon: CalendarClock, keywords: ["booking", "pinjam mobil", "perjalanan", "trip", "dinas"] },
        { title: "P2H", url: "/fleet/p2h", icon: ClipboardCheck, roles: ["admin", "driver"], keywords: ["p2h", "pemeriksaan", "inspeksi", "cek harian", "kelayakan"] },
        { title: "Riwayat P2H", url: "/fleet/p2h/history", icon: History, roles: ["admin", "driver"], keywords: ["p2h", "riwayat", "log"] },
        { title: "Jadwal P2H", url: "/fleet/p2h/schedule", icon: ClipboardList, roles: ADMIN, keywords: ["p2h", "mingguan", "kepatuhan", "jadwal"] },
        { title: "Monitoring GPS", url: "/fleet/monitoring", icon: MapPinned, roles: ADMIN, keywords: ["gps", "peta", "lokasi", "tracking", "map"] },
        { title: "Rasio BBM", url: "/fleet/fuel", icon: Fuel, roles: ["admin", "driver"], keywords: ["bbm", "bensin", "solar", "fuel", "km per liter"] },
      ],
    },
    {
      label: "Armada",
      items: [
        { title: "Kendaraan", url: "/fleet/vehicles", icon: CarFront, roles: ADMIN, keywords: ["kendaraan", "mobil", "unit", "database armada", "plat"] },
        { title: "Driver", url: "/fleet/drivers", icon: UserRound, roles: ADMIN, keywords: ["driver", "sopir", "pengemudi", "assignment"] },
        { title: "Perbaikan", url: "/fleet/repairs", icon: Wrench, roles: ADMIN, keywords: ["perbaikan", "servis", "repair", "bengkel", "kerusakan"] },
        { title: "Prediksi Servis", url: "/fleet/maintenance", icon: CalendarRange, roles: ADMIN, keywords: ["prediksi", "jadwal servis", "maintenance", "part", "ganti oli"] },
        { title: "Prediksi Tahunan", url: "/fleet/annual-plan", icon: CalendarRange, roles: ADMIN, keywords: ["tahunan", "proker", "anggaran", "biaya perawatan"] },
      ],
    },
    {
      label: "Pengaturan Fleet",
      items: [
        { title: "Pengaturan", url: "/fleet/settings", icon: Settings2, roles: ADMIN, keywords: ["part", "checklist", "pemeriksa", "inspector", "suku cadang"] },
        { title: "SOP Fleet", url: "/fleet/sop", icon: BookOpen, keywords: ["panduan", "sop", "bantuan"] },
      ],
    },
  ],
};
