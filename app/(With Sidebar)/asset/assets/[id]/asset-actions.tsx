"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Handshake, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/hooks/use-action";
import { ASSET_STATUS } from "@/lib/status";
import type { AssetRow, AssetStatus } from "@/lib/asset/types";
import { AssetFormDialog, type AssetFormOptions } from "../asset-form";
import { deleteAsset, setAssetStatus } from "../actions";
import { LoanRequestDialog, MutationRequestDialog, type AssetPick } from "../../_components/asset-dialogs";

export function AssetDetailActions({
  asset,
  photoUrl,
  options,
  pick,
  perms,
}: {
  asset: AssetRow;
  photoUrl: string | null;
  options: AssetFormOptions;
  pick: AssetPick;
  perms: { write: boolean; delete: boolean; loan: boolean; mutate: boolean; admin: boolean };
}) {
  const { run } = useAction();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/print/asset-labels?ids=${asset.id}`} target="_blank">
          <Printer />
          Label QR
        </Link>
      </Button>
      {perms.loan && asset.is_borrowable && asset.status === "ready" && (
        <LoanRequestDialog
          assets={[pick]}
          employees={options.employees}
          isAdmin={perms.admin}
          defaultAssetId={asset.id}
          trigger={
            <Button variant="outline">
              <Handshake />
              Pinjam
            </Button>
          }
        />
      )}
      {perms.mutate && asset.status !== "loaned" && asset.status !== "disposed" && (
        <MutationRequestDialog
          assets={[pick]}
          employees={options.employees}
          sites={options.sites}
          isAdmin={perms.admin}
          defaultAssetId={asset.id}
          trigger={
            <Button variant="outline">
              <ArrowLeftRight />
              Mutasi
            </Button>
          }
        />
      )}
      {perms.write && (
        <AssetFormDialog
          asset={asset}
          options={options}
          photoUrl={photoUrl}
          trigger={
            <Button>
              <Pencil />
              Edit
            </Button>
          }
        />
      )}
      {(perms.admin || perms.delete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Aksi lain">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {perms.admin && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Ubah status</DropdownMenuLabel>
                {(["ready", "damaged", "lost", "disposed"] as AssetStatus[])
                  .filter((st) => st !== asset.status)
                  .map((st) => (
                    <DropdownMenuItem key={st} onSelect={() => run(() => setAssetStatus(asset.id, st))} disabled={asset.status === "loaned"}>
                      {ASSET_STATUS[st].label}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
            {perms.delete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 />
                  Hapus aset
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {confirmDelete && (
        <ConfirmButton
          defaultOpen
          onOpenChange={(o) => !o && setConfirmDelete(false)}
          trigger={<span className="hidden" />}
          destructive
          title={`Hapus ${asset.code}?`}
          description="Riwayat pinjam, mutasi, dan audit aset ini ikut terhapus. Untuk aset yang sudah tidak dipakai, gunakan status Disposal."
          confirmText="Hapus permanen"
          onConfirm={async () => {
            const ok = await run(() => deleteAsset(asset.id), { refresh: false });
            if (ok) router.push("/asset/assets");
            return ok;
          }}
        />
      )}
    </div>
  );
}
