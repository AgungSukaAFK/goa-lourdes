"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Check, ExternalLink, Hand, MoreHorizontal, Pencil, Play, RotateCcw, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialog } from "@/components/form-dialog";
import { StatusBadge } from "@/components/status-badge";
import type { Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { GOA_TASK_STATUS } from "@/lib/status";
import { cn, formatDateTime } from "@/lib/utils";
import type { GoaTask } from "@/lib/goa/types";
import { deleteTask, finishTask, rateTask, reopenTask, startTask } from "../actions";
import { TaskFormDialog } from "./task-form";

export type TaskCtx = {
  selfId: string;
  isSupervisor: boolean;
  canWork: boolean;
  members: Option[];
  categories: string[];
  companies: Option[];
};

export function FinishButtons({ task }: { task: GoaTask }) {
  const { run } = useAction();
  return (
    <>
      <FormDialog
        trigger={
          <Button size="sm">
            <Check />
            Selesai
          </Button>
        }
        title={`Selesaikan ${task.code}`}
        submitText="Selesai"
        onSubmit={(fd) => run(() => finishTask(task.id, true, String(fd.get("note") ?? "")))}
      >
        <Field label="Catatan hasil" htmlFor={`dn-${task.id}`}>
          <Textarea id={`dn-${task.id}`} name="note" rows={3} placeholder="Apa yang dikerjakan / hasilnya" />
        </Field>
      </FormDialog>
      <FormDialog
        trigger={
          <Button size="sm" variant="outline" aria-label="Tidak selesai">
            <X />
            Tidak selesai
          </Button>
        }
        title={`Tutup ${task.code} sebagai tidak selesai`}
        submitText="Tutup"
        onSubmit={(fd) => run(() => finishTask(task.id, false, String(fd.get("note") ?? "")))}
      >
        <Field label="Alasan" htmlFor={`un-${task.id}`} required>
          <Textarea id={`un-${task.id}`} name="note" rows={3} required />
        </Field>
      </FormDialog>
    </>
  );
}

export function RatingStars({ task, canRate }: { task: GoaTask; canRate: boolean }) {
  const { run, pending } = useAction();
  const [hover, setHover] = useState(0);
  const value = hover || task.rating || 0;
  if (!canRate && !task.rating) return null;
  return (
    <div className="flex items-center gap-0.5" role={canRate ? "radiogroup" : undefined} aria-label="Nilai tugas" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) =>
        canRate ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={task.rating === n}
            aria-label={`${n} bintang`}
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onClick={() => run(() => rateTask(task.id, n))}
            className="rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cn("size-4", n <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
          </button>
        ) : (
          <Star key={n} className={cn("size-3.5", n <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40")} aria-hidden="true" />
        ),
      )}
      {!canRate && <span className="sr-only">{task.rating} dari 5</span>}
    </div>
  );
}

/** Kartu tugas dengan aksi sesuai status & peran. */
export function TaskCard({ task, ctx, compact }: { task: GoaTask; ctx: TaskCtx; compact?: boolean }) {
  const { run } = useAction();
  const mine = task.assignee_id === ctx.selfId;
  const open = task.status === "pending" || task.status === "in_progress";
  const canAct = ctx.canWork && (mine || !task.assignee_id || ctx.isSupervisor);
  const canRate = task.status === "done" && (ctx.isSupervisor || task.reviewer_id === ctx.selfId) && task.assignee_id !== ctx.selfId;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{task.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {task.code}
            {task.job_category && ` · ${task.job_category}`}
          </p>
        </div>
        {(ctx.isSupervisor || (task.status === "pending" && task.source === "manual")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Aksi ${task.code}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ctx.isSupervisor && (
                <TaskFormDialog
                  task={task}
                  members={ctx.members}
                  categories={ctx.categories}
                  companies={ctx.companies}
                  isSupervisor
                  selfId={ctx.selfId}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                  }
                />
              )}
              {ctx.isSupervisor && !open && (
                <DropdownMenuItem onSelect={() => run(() => reopenTask(task.id))}>
                  <RotateCcw />
                  Buka kembali
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => run(() => deleteTask(task.id))}>
                <Trash2 />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!compact && task.description && <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{task.description}</p>}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <StatusBadge map={GOA_TASK_STATUS} value={task.is_overdue ? "overdue" : task.status} />
        {task.type === "routine" && <Badge variant="outline" className="text-[10px]">Rutin</Badge>}
        {task.source === "p2h" && <Badge variant="outline" className="text-[10px]">P2H</Badge>}
        <span className="text-muted-foreground">{task.assignee_name ?? "General Pool"}</span>
      </div>
      {task.due_at && (
        <p className={cn("flex items-center gap-1 text-xs", task.is_overdue ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground")}>
          <CalendarClock className="size-3.5" /> {formatDateTime(task.due_at)}
        </p>
      )}
      {task.status === "done" && task.done_notes && !compact && <p className="text-xs text-muted-foreground">✓ {task.done_notes}</p>}
      {(task.status === "undone" || task.status === "expired") && task.undone_reason && (
        <p className="text-xs text-muted-foreground">Alasan: {task.undone_reason}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {open && canAct && task.status === "pending" && (
          <Button size="sm" variant={task.assignee_id ? "default" : "outline"} onClick={() => run(() => startTask(task.id))}>
            {task.assignee_id ? <Play /> : <Hand />}
            {task.assignee_id ? "Mulai" : "Ambil"}
          </Button>
        )}
        {open && canAct && (task.status === "in_progress" || mine) && <FinishButtons task={task} />}
        {task.link && open && (
          <Button asChild size="sm" variant="ghost">
            <Link href={task.link}>
              <ExternalLink />
              Buka
            </Link>
          </Button>
        )}
        {task.status === "done" && <RatingStars task={task} canRate={canRate} />}
      </div>
    </div>
  );
}
