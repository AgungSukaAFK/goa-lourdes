"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/hooks/use-action";
import { deleteP2h } from "../../actions";

export function P2hDetailActions({ id, code, canDelete }: { id: string; code: string; canDelete: boolean }) {
  const { run } = useAction();
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button asChild variant="outline">
        <Link href={`/print/fleet-p2h/${id}`} target="_blank">
          <Printer />
          Cetak
        </Link>
      </Button>
      {canDelete && (
        <ConfirmButton
          destructive
          title={`Hapus ${code}?`}
          description="Foto ikut terhapus. Perbaikan yang sudah dibuat dari P2H ini tetap ada."
          confirmText="Hapus"
          onConfirm={async () => {
            const ok = await run(() => deleteP2h(id), { refresh: false });
            if (ok) router.push("/fleet/p2h/history");
            return ok;
          }}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Hapus P2H">
              <Trash2 className="text-destructive" />
            </Button>
          }
        />
      )}
    </div>
  );
}
