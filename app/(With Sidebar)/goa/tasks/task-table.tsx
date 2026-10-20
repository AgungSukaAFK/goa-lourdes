"use client";

import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHead } from "@/components/list/sort-head";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/hooks/use-action";
import { GOA_TASK_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { isClosed, type GoaTask } from "@/lib/goa/types";
import { RatingStars, canRateTask, type TaskCtx } from "../_components/task-card";
import { deleteTasks, rateTasks } from "../actions";
import { TaskRowMenu } from "./task-row-menu";
import { TaskFilesDialog } from "../_components/task-files";

export function TaskTable({ rows, ctx }: { rows: GoaTask[]; ctx: TaskCtx }) {
  const { run, pending } = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  // Baris yang bisa dipilih: atasan semua (untuk hapus), reviewer hanya yang bisa ia nilai.
  const selectable = rows.filter((t) => ctx.isSupervisor || canRateTask(t, ctx)).map((t) => t.id);
  const all = selectable.length > 0 && selectable.every((id) => selected.includes(id));
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  // Yang dinilai hanya tugas tertutup yang belum punya nilai, supaya nilai lama tidak tertimpa massal.
  const toRate = rows.filter((t) => selected.includes(t.id) && canRateTask(t, ctx) && !t.rating).map((t) => t.id);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm dark:bg-muted/10">
          <span>
            {selected.length} tugas dipilih
            {toRate.length !== selected.length && <span className="text-muted-foreground"> · {toRate.length} siap dinilai</span>}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Beri nilai tugas terpilih">
            <span className="mr-1 text-xs text-muted-foreground">Beri nilai</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                size="sm"
                variant="outline"
                disabled={pending || !toRate.length}
                onClick={() => run(() => rateTasks(toRate, n)).then((ok) => ok && setSelected([]))}
                aria-label={`Beri nilai ${n} bintang`}
              >
                {n}
                <Star className="fill-amber-400 text-amber-500" />
              </Button>
            ))}
          </div>
          {ctx.isSupervisor && (
            <ConfirmButton
              destructive
              title={`Hapus ${selected.length} tugas?`}
              description="Tugas terpilih dihapus permanen dan tidak bisa dikembalikan."
              confirmText="Hapus"
              onConfirm={() => run(() => deleteTasks(selected)).then((ok) => ok && setSelected([]))}
              trigger={
                <Button size="sm" variant="outline" className="text-destructive" disabled={pending}>
                  <Trash2 />
                  Hapus
                </Button>
              }
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Batal
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {selectable.length > 0 && (
              <TableHead className="w-8">
                <Checkbox aria-label="Pilih semua" checked={all} onCheckedChange={(v) => setSelected(v === true ? selectable : [])} />
              </TableHead>
            )}
            <TableHead>Tugas</TableHead>
            <TableHead>PIC</TableHead>
            <SortHead k="created" defaultDirection="desc">Dibuat</SortHead>
            <SortHead k="due">Batas</SortHead>
            <TableHead>Status</TableHead>
            <TableHead>Nilai</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id} data-state={selected.includes(t.id) ? "selected" : undefined}>
              {selectable.length > 0 && (
                <TableCell>
                  {selectable.includes(t.id) && (
                    <Checkbox aria-label={`Pilih ${t.code}`} checked={selected.includes(t.id)} onCheckedChange={(v) => toggle(t.id, v === true)} />
                  )}
                </TableCell>
              )}
              <TableCell className="max-w-[22rem]">
                <div className="font-medium">{t.title}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {t.code} · {t.job_category ?? "-"}
                  {t.type === "routine" && " · rutin"}
                </div>
              </TableCell>
              <TableCell>{t.assignee_name ?? <span className="text-muted-foreground">General Pool</span>}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{formatDateTime(t.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {t.due_at ? formatDateTime(t.due_at) : "-"}
                {t.status === "pending" && t.start_at && <div className="text-xs text-muted-foreground">Mulai {formatDateTime(t.start_at)}</div>}
              </TableCell>
              <TableCell>
                <StatusBadge map={GOA_TASK_STATUS} value={t.is_overdue ? "overdue" : t.status} />
                {t.duration_minutes != null && t.status === "done" && <div className="mt-0.5 text-xs text-muted-foreground">{t.duration_minutes} menit</div>}
              </TableCell>
              <TableCell>
                {isClosed(t) ? <RatingStars task={t} canRate={canRateTask(t, ctx)} /> : <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <TaskFilesDialog task={t} ctx={ctx} size="icon" />
                  <TaskRowMenu task={t} ctx={ctx} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
