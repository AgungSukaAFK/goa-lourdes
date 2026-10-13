"use client";

import { MoreHorizontal, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import type { GoaTask } from "@/lib/goa/types";
import { deleteTask, reopenTask, startTask } from "../actions";
import { TaskFormDialog } from "../_components/task-form";
import type { TaskCtx } from "../_components/task-card";

export function TaskRowMenu({ task, ctx }: { task: GoaTask; ctx: TaskCtx }) {
  const { run } = useAction();
  const open = task.status === "pending" || task.status === "in_progress";
  const canStart = ctx.canWork && task.status === "pending" && (!task.assignee_id || task.assignee_id === ctx.selfId || ctx.isSupervisor);
  if (!ctx.isSupervisor && !canStart) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Aksi ${task.code}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canStart && (
          <DropdownMenuItem onSelect={() => run(() => startTask(task.id))}>
            <Play />
            {task.assignee_id ? "Mulai" : "Ambil"}
          </DropdownMenuItem>
        )}
        {ctx.isSupervisor && (
          <>
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
            {!open && (
              <DropdownMenuItem onSelect={() => run(() => reopenTask(task.id))}>
                <RotateCcw />
                Buka kembali
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => run(() => deleteTask(task.id))}>
              <Trash2 />
              Hapus
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
