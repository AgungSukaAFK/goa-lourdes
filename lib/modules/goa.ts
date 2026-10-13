import {
  CalendarCog,
  ClipboardList,
  Kanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  UsersRound,
} from "lucide-react";
import type { ModuleConfig } from "./types";

const WORKERS = ["supervisor", "member"];

export const goaModule: ModuleConfig = {
  id: "goa",
  name: "GOA",
  description: "Tugas & KPI tim GA",
  icon: ListChecks,
  basePath: "/goa",
  keywords: ["goa", "tugas", "task", "tim", "ga"],
  groups: [
    {
      label: "Pekerjaan",
      items: [
        { title: "Dashboard", url: "/goa", icon: LayoutDashboard, keywords: ["beranda", "ringkasan", "beban kerja"] },
        { title: "Tugas Saya", url: "/goa/my-tasks", icon: ClipboardList, roles: WORKERS, keywords: ["tugas saya", "my task", "kerjaan"] },
        { title: "Workflow", url: "/goa/board", icon: Kanban, keywords: ["kanban", "board", "workflow", "papan"] },
        { title: "Tabel Tugas", url: "/goa/tasks", icon: Table2, keywords: ["tabel", "semua tugas", "export", "pptx"] },
        { title: "Planner Rutin", url: "/goa/planner", icon: CalendarCog, roles: ["supervisor"], keywords: ["rutin", "template", "planner", "jadwal", "blokir"] },
      ],
    },
    {
      label: "Tim",
      items: [
        { title: "Tim & KPI", url: "/goa/team", icon: UsersRound, roles: WORKERS, keywords: ["kpi", "tim", "matrix", "nilai", "sp"] },
        { title: "Saran Performa", url: "/goa/insights", icon: Lightbulb, roles: WORKERS, keywords: ["ai", "saran", "performa", "insight"] },
        { title: "Safety Topic", url: "/goa/safety", icon: ShieldCheck, keywords: ["k3", "safety", "keselamatan"] },
        { title: "Pengaturan KPI", url: "/goa/settings", icon: SlidersHorizontal, roles: ["supervisor"], keywords: ["bobot", "parameter", "kpi", "hari libur"] },
      ],
    },
  ],
};
