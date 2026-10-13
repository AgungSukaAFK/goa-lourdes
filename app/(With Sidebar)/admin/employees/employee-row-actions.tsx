"use client";

import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import type { Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import type { Employee } from "@/lib/types";
import { DEFAULT_PASSWORD } from "@/lib/auth/identity";
import { createAccounts, deleteEmployee } from "./actions";
import { EmployeeFormDialog, type SiteOption } from "./employee-form";

export function EmployeeRowActions({
  employee,
  companies,
  sites,
  canCreateAccount,
}: {
  employee: Employee;
  companies: Option[];
  sites: SiteOption[];
  canCreateAccount: boolean;
}) {
  const { run } = useAction();
  return (
    <div className="flex justify-end gap-1">
      {canCreateAccount && (
        <ConfirmButton
          title={`Buat akun untuk ${employee.name}?`}
          description={
            <>
              Login dengan NRP <b>{employee.nrp}</b> dan password <b>{DEFAULT_PASSWORD}</b>. Akun langsung aktif,
              lalu atur akses modulnya di User Management.
            </>
          }
          confirmText="Buat akun"
          onConfirm={() => run(() => createAccounts([employee.id]))}
          trigger={
            <Button variant="ghost" size="sm" title="Buat akun login" aria-label={`Buat akun ${employee.name}`}>
              <KeyRound />
            </Button>
          }
        />
      )}
      <EmployeeFormDialog
        employee={employee}
        companies={companies}
        sites={sites}
        trigger={
          <Button variant="ghost" size="sm" title="Edit" aria-label={`Edit ${employee.name}`}>
            <Pencil />
          </Button>
        }
      />
      <ConfirmButton
        destructive
        title={`Hapus ${employee.name}?`}
        description="Kalau karyawan sudah keluar, lebih aman dinonaktifkan supaya riwayat aset/booking tetap utuh."
        confirmText="Hapus"
        onConfirm={() => run(() => deleteEmployee(employee.id))}
        trigger={
          <Button variant="ghost" size="sm" title="Hapus" aria-label={`Hapus ${employee.name}`}>
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}
