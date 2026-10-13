"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/hooks/use-action";
import type { ActionResult } from "@/lib/actions/result";

export function RowDelete({ label, onDelete }: { label: string; onDelete: () => Promise<ActionResult> }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      destructive
      title={`Hapus ${label}?`}
      confirmText="Hapus"
      onConfirm={() => run(onDelete)}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Hapus ${label}`} title="Hapus">
          <Trash2 className="text-destructive" />
        </Button>
      }
    />
  );
}
