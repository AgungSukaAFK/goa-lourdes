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
  /** Jadwal mulai otomatis (cron tiap 5 menit, hanya tugas ber-PIC). */
  start_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  undone_reason: string | null;
  done_notes: string | null;
  source: "manual" | "template" | "p2h";
  link: string | null;
  created_by: string | null;
  created_at: string;
  // view
  assignee_name: string | null;
  reviewer_name: string | null;
  created_by_name: string | null;
  is_overdue: boolean;
  file_count: number;
};

export type GoaFileKind = "before" | "after" | "review";

export type GoaTaskFile = {
  id: string;
  task_id: string;
  kind: GoaFileKind;
  path: string;
  name: string;
  mime: string;
  size: number;
  uploaded_by: string | null;
  uploader_name: string | null;
  created_at: string;
  url: string | null;
};

export const FILE_KINDS: { kind: GoaFileKind; label: string; desc: string }[] = [
  { kind: "before", label: "Foto before", desc: "Kondisi awal dari atasan / pembuat tugas." },
  { kind: "after", label: "Bukti selesai", desc: "Foto/dokumen hasil pekerjaan dari PIC." },
  { kind: "review", label: "Lampiran reviewer", desc: "File dari reviewer/atasan saat menilai." },
];

export const MAX_FILES_PER_KIND = 10;
export const MAX_FILE_MB = 10;
export const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx";

type Who = { selfId: string; isSupervisor: boolean; canWork: boolean };

/** Sama dengan cek di goa_add_task_files. */
export function canUploadKind(t: Pick<GoaTask, "status" | "assignee_id" | "reviewer_id" | "created_by">, kind: GoaFileKind, who: Who) {
  const open = t.status === "pending" || t.status === "in_progress";
  if (kind === "before") return open && (who.isSupervisor || t.created_by === who.selfId);
  if (kind === "after") return who.canWork && (open || t.status === "done") && (who.isSupervisor || (t.assignee_id ?? who.selfId) === who.selfId);
  return !open && (who.isSupervisor || t.reviewer_id === who.selfId) && t.assignee_id !== who.selfId;
}

/** Sama dengan cek di goa_delete_task_file. */
export function canDeleteFile(f: Pick<GoaTaskFile, "kind" | "uploaded_by">, t: Pick<GoaTask, "status">, who: Pick<Who, "selfId" | "isSupervisor">) {
  if (who.isSupervisor) return true;
  if (f.uploaded_by !== who.selfId) return false;
  return f.kind !== "after" || t.status === "pending" || t.status === "in_progress";
}

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
  { key: "quality", label: "Rating reviewer", desc: "Rata-rata nilai reviewer (1–5) untuk tugas yang sudah ditutup, dalam skala 100." },
  { key: "done_ratio", label: "Penyelesaian tugas", desc: "Selesai ÷ (selesai + tidak selesai + hangus)." },
  { key: "active_ratio", label: "Keaktifan", desc: "% tugas yang sudah disentuh (tidak dibiarkan pending)." },
  { key: "p2h", label: "Kepatuhan P2H", desc: "% task P2H mingguan yang selesai (untuk anggota yang memegang P2H)." },
];

// Sama dengan GOA 5.5: 60% penyelesaian + 40% rating.
export const DEFAULT_KPI: KpiParam[] = [
  { key: "done_ratio", label: "Penyelesaian tugas", weight: 3 },
  { key: "quality", label: "Rating reviewer", weight: 2 },
];

/** Status tugas yang sudah ditutup (boleh dinilai). */
export const CLOSED_STATUSES: GoaTask["status"][] = ["done", "undone", "expired"];
export const isClosed = (t: Pick<GoaTask, "status">) => CLOSED_STATUSES.includes(t.status);

export const SP_PENALTY: Record<string, number> = { none: 0, sp1: 5, sp2: 10, sp3: 20 };
