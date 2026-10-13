"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionButtons } from "../_components/asset-dialogs";
import { RowDelete } from "../_components/row-delete";
import { deleteMutation } from "./actions";

export function MutationRowActions({
  id,
  code,
  status,
  isAdmin,
  canDelete,
}: {
  id: string;
  code: string;
  status: string;
  isAdmin: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {isAdmin && status === "pending" && <DecisionButtons kind="mutation" id={id} code={code} />}
      {status !== "rejected" && (
        <Button asChild variant="ghost" size="sm" title="Cetak berita acara">
          <Link href={`/print/asset-mutation/${id}`} target="_blank" aria-label={`Cetak ${code}`}>
            <Printer />
          </Link>
        </Button>
      )}
      {canDelete && (status === "pending" || status === "rejected") && <RowDelete label={code} onDelete={() => deleteMutation(id)} />}
    </div>
  );
}
