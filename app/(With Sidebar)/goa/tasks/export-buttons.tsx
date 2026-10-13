"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportExcel } from "@/lib/excel";
import { exportTasksPptx } from "@/lib/goa/pptx";
import { GOA_TASK_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import type { GoaTask } from "@/lib/goa/types";
import { exportTasks } from "../actions";

export function ExportButtons() {
  const sp = useSearchParams();
  const [busy, setBusy] = useState<null | "xlsx" | "pptx">(null);

  const load = async () => {
    const res = await exportTasks(Object.fromEntries(sp.entries()));
    if (!res.ok || !res.data?.length) {
      toast.error(res.ok ? "Tidak ada data untuk diekspor." : res.error);
      return null;
    }
    return res.data as unknown as GoaTask[];
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={async () => {
          setBusy("xlsx");
          const rows = await load();
          if (rows)
            await exportExcel<GoaTask>(`tugas-${new Date().toISOString().slice(0, 10)}`, [
              {
                name: "Tugas",
                rows,
                columns: [
                  { header: "Kode", key: "code", width: 18 },
                  { header: "Tugas", key: "title", width: 40 },
                  { header: "Kategori", key: "job_category" },
                  { header: "Tipe", key: "type", value: (r) => (r.type === "routine" ? "Rutin" : "Sekali") },
                  { header: "PIC", key: "assignee_name", value: (r) => r.assignee_name ?? "General Pool" },
                  { header: "Status", key: "status", value: (r) => GOA_TASK_STATUS[r.status]?.label ?? r.status },
                  { header: "Dibuat", key: "created_at", value: (r) => formatDateTime(r.created_at) },
                  { header: "Batas", key: "due_at", value: (r) => (r.due_at ? formatDateTime(r.due_at) : "") },
                  { header: "Selesai", key: "completed_at", value: (r) => (r.completed_at ? formatDateTime(r.completed_at) : "") },
                  { header: "Durasi (menit)", key: "duration_minutes" },
                  { header: "Nilai", key: "rating" },
                  { header: "Catatan", key: "done_notes", width: 30 },
                  { header: "Alasan tidak selesai", key: "undone_reason", width: 30 },
                ],
              },
            ]);
          setBusy(null);
        }}
      >
        {busy === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        Excel
      </Button>
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={async () => {
          setBusy("pptx");
          const rows = await load();
          if (rows) await exportTasksPptx(rows, "Laporan Tugas Tim GA");
          setBusy(null);
        }}
      >
        {busy === "pptx" ? <Loader2 className="animate-spin" /> : <Presentation />}
        PPTX
      </Button>
    </>
  );
}
