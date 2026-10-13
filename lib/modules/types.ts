import type { LucideIcon } from "lucide-react";
import type { AppModule, ModuleAccess } from "@/lib/types";

/** Data akses yang dikirim server ke sidebar (serializable). */
export type NavAccess = {
  isModerator: boolean;
  access: ModuleAccess;
};

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Role modul yang boleh melihat. Kosong = semua role di modul itu. */
  roles?: string[];
  /** Asset: kunci hak per menu (untuk role staff). */
  permission?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export type ModuleConfig = {
  id: AppModule;
  name: string;
  description: string;
  icon: LucideIcon;
  basePath: `/${string}`;
  keywords: string[];
  groups: NavGroup[];
};
