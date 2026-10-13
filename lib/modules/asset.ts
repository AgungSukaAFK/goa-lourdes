import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  ClipboardCheck,
  Handshake,
  LayoutDashboard,
  Package,
  QrCode,
  Tags,
} from "lucide-react";
import type { ModuleConfig } from "./types";

export const assetModule: ModuleConfig = {
  id: "asset",
  name: "Asset",
  description: "Aset, peminjaman & mutasi",
  icon: Package,
  basePath: "/asset",
  keywords: ["aset", "asset", "inventaris", "barang"],
  groups: [
    {
      label: "Asset",
      items: [
        { title: "Dashboard", url: "/asset", icon: LayoutDashboard, permission: "dashboard", keywords: ["beranda", "ringkasan"] },
        { title: "Daftar Aset", url: "/asset/assets", icon: Package, permission: "assets", keywords: ["aset", "inventaris", "label", "qr"] },
        { title: "Scan QR", url: "/asset/scan", icon: QrCode, permission: "assets", keywords: ["scan", "kamera", "qr", "barcode"] },
        { title: "Peminjaman", url: "/asset/loans", icon: Handshake, permission: "loans", keywords: ["pinjam", "loan", "kembali"] },
        { title: "Mutasi", url: "/asset/mutations", icon: ArrowLeftRight, permission: "mutations", keywords: ["mutasi", "pindah", "transfer", "serah terima"] },
        { title: "Audit", url: "/asset/audits", icon: ClipboardCheck, permission: "audits", keywords: ["audit", "cek fisik", "opname", "stock opname"] },
      ],
    },
    {
      label: "Pengaturan Asset",
      items: [
        { title: "Kategori", url: "/asset/categories", icon: Tags, permission: "config", keywords: ["kategori", "penyusutan", "depresiasi"] },
        { title: "Log Aktivitas", url: "/asset/activity", icon: Activity, permission: "config", keywords: ["log", "riwayat", "history"] },
        { title: "SOP Asset", url: "/asset/sop", icon: BookOpen, permission: "sop", keywords: ["panduan", "sop", "bantuan"] },
      ],
    },
  ],
};
