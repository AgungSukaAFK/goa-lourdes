"use client";

import { KeyRound, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/confirm-button";
import type { Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { DEFAULT_PASSWORD } from "@/lib/auth/identity";
import { deleteUser, resetPassword, setUserActive } from "./actions";
import { UserFormDialog, type UserRow } from "./user-form";

export function UserRowActions({
  user,
  isSelf,
  companies,
  employees,
}: {
  user: UserRow;
  isSelf: boolean;
  companies: Option[];
  employees: Option[];
}) {
  const { run } = useAction();
  const [dialog, setDialog] = useState<null | "reset" | "delete">(null);

  return (
    <div className="flex justify-end gap-1">
      {!user.is_active && user.company && (
        <Button variant="outline" size="sm" onClick={() => run(() => setUserActive(user.id, true))}>
          <Power />
          Aktifkan
        </Button>
      )}
      <UserFormDialog
        user={user}
        companies={companies}
        employees={employees}
        trigger={
          <Button variant="ghost" size="sm" title="Edit" aria-label={`Edit ${user.name}`}>
            <Pencil />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Aksi lain untuk ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("reset")}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          {user.is_active && !isSelf && (
            <DropdownMenuItem onSelect={() => run(() => setUserActive(user.id, false))}>
              <PowerOff />
              Nonaktifkan
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => setDialog("delete")}>
                <Trash2 />
                Hapus akun
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "reset" && (
        <ConfirmDialogInline
          title={`Reset password ${user.name}?`}
          description={`Password diganti menjadi ${DEFAULT_PASSWORD}. Beri tahu user untuk menggantinya di Profil.`}
          confirmText="Reset"
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => resetPassword(user.id))}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialogInline
          destructive
          title={`Hapus akun ${user.name}?`}
          description="Akun login dihapus permanen. Data karyawan dan riwayat transaksi tetap ada."
          confirmText="Hapus"
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteUser(user.id))}
        />
      )}
    </div>
  );
}

/** ConfirmButton yang langsung terbuka (dipicu dari menu dropdown). */
function ConfirmDialogInline(props: {
  title: string;
  description: string;
  confirmText: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  return (
    <ConfirmButton
      defaultOpen
      onOpenChange={(o) => !o && props.onClose()}
      trigger={<span className="hidden" />}
      title={props.title}
      description={props.description}
      confirmText={props.confirmText}
      destructive={props.destructive}
      onConfirm={props.onConfirm}
    />
  );
}
