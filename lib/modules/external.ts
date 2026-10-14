import { FileBox } from "lucide-react";
import type { ExternalModuleConfig } from "./types";

export const gaWebModule: ExternalModuleConfig = {
  id: "ga-web",
  name: "GA Web",
  description: "Material Request & PO",
  icon: FileBox,
  href: "https://ga.lourdes.cloud/dashboard",
};

/** Tampil untuk semua user, sebelum modul internal (urutan sama dengan ga.lourdes.cloud). */
export const EXTERNAL_MODULES: ExternalModuleConfig[] = [gaWebModule];
