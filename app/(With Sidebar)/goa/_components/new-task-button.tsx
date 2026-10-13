"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./task-form";
import type { TaskCtx } from "./task-card";

export function NewTaskButton({ ctx }: { ctx: TaskCtx }) {
  if (!ctx.canWork) return null;
  return (
    <TaskFormDialog
      members={ctx.members}
      categories={ctx.categories}
      companies={ctx.companies}
      isSupervisor={ctx.isSupervisor}
      selfId={ctx.selfId}
      trigger={
        <Button>
          <Plus />
          Tugas Baru
        </Button>
      }
    />
  );
}
