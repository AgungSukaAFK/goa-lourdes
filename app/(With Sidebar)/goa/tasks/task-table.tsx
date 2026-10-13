"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHead } from "@/components/list/sort-head";
import { StatusBadge } from "@/components/status-badge";
import { GOA_TASK_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import type { GoaTask } from "@/lib/goa/types";
import { RatingStars, type TaskCtx } from "../_components/task-card";
import { TaskRowMenu } from "./task-row-menu";

export function TaskTable({ rows, ctx }: { rows: GoaTask[]; ctx: TaskCtx }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tugas</TableHead>
          <TableHead>PIC</TableHead>
          <SortHead k="created" defaultDirection="desc">Dibuat</SortHead>
          <SortHead k="due">Batas</SortHead>
          <TableHead>Status</TableHead>
          <TableHead>Nilai</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="max-w-[22rem]">
              <div className="font-medium">{t.title}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {t.code} · {t.job_category ?? "-"}
                {t.type === "routine" && " · rutin"}
              </div>
            </TableCell>
            <TableCell>{t.assignee_name ?? <span className="text-muted-foreground">General Pool</span>}</TableCell>
            <TableCell className="whitespace-nowrap text-sm">{formatDateTime(t.created_at)}</TableCell>
            <TableCell className="whitespace-nowrap text-sm">{t.due_at ? formatDateTime(t.due_at) : "-"}</TableCell>
            <TableCell>
              <StatusBadge map={GOA_TASK_STATUS} value={t.is_overdue ? "overdue" : t.status} />
              {t.duration_minutes != null && t.status === "done" && <div className="mt-0.5 text-xs text-muted-foreground">{t.duration_minutes} menit</div>}
            </TableCell>
            <TableCell>
              {t.status === "done" ? (
                <RatingStars task={t} canRate={(ctx.isSupervisor || t.reviewer_id === ctx.selfId) && t.assignee_id !== ctx.selfId} />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <TaskRowMenu task={t} ctx={ctx} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
