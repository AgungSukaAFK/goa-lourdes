export type GoaTask = {
  id: string;
  code: string;
  company: string;
  template_id: string | null;
  task_date: string | null;
  title: string;
  description: string | null;
  type: "once" | "routine";
  job_category: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
  status: "pending" | "in_progress" | "done" | "undone" | "expired";
  rating: number | null;
  start_time: string | null;
  due_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  undone_reason: string | null;
  done_notes: string | null;
  source: "manual" | "template" | "p2h";
  link: string | null;
  created_at: string;
  // view
  assignee_name: string | null;
  reviewer_name: string | null;
  created_by_name: string | null;
  is_overdue: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  nrp: string | null;
  company: string | null;
  avatar_path: string | null;
  role: "supervisor" | "member" | "guest";
  title: string | null;
  sp_level: "none" | "sp1" | "sp2" | "sp3";
  sp_date: string | null;
  presence_status: string;
  backup_profile_id: string | null;
  backup_name: string | null;
  join_date: string | null;
  position: string | null;
};

export type KpiParam = { key: KpiKey; label: string; weight: number };
export type KpiKey = "speed" | "quality" | "done_ratio" | "active_ratio" | "p2h";

export const KPI_KEYS: { key: KpiKey; label: string; desc: string }[] = [
  { key: "speed", label: "Ketepatan waktu", desc: "% tugas selesai sebelum batas waktu (tanpa batas: dikerjakan < 24 jam sejak dibuat)." },
  { key: "quality", label: "Kualitas (rating)", desc: "Rata-rata nilai atasan (1–5) untuk tugas selesai, dalam skala 100." },
  { key: "done_ratio", label: "Rasio selesai", desc: "Selesai ÷ (selesai + tidak selesai + hangus)." },
  { key: "active_ratio", label: "Keaktifan", desc: "% tugas yang sudah disentuh (tidak dibiarkan pending)." },
  { key: "p2h", label: "Kepatuhan P2H", desc: "% task P2H mingguan yang selesai (untuk anggota yang memegang P2H)." },
];

export const DEFAULT_KPI: KpiParam[] = [
  { key: "speed", label: "Ketepatan waktu", weight: 1 },
  { key: "quality", label: "Kualitas (rating)", weight: 2 },
  { key: "done_ratio", label: "Rasio selesai", weight: 1 },
  { key: "active_ratio", label: "Keaktifan", weight: 1 },
];

export const SP_PENALTY: Record<string, number> = { none: 0, sp1: 5, sp2: 10, sp3: 20 };
