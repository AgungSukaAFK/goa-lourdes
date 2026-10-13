"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { OptionSelect, type Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import { ASSET_ACTIONS, ASSET_PERMISSION_MENUS, DEFAULT_STAFF_PERMISSIONS } from "@/lib/modules/asset-permissions";
import { MODULE_ROLE_LABELS, type MenuPermissions, type ModuleAccess, type Profile } from "@/lib/types";
import { isSyntheticEmail } from "@/lib/auth/identity";
import { createUser, updateUser } from "./actions";

export type UserRow = Profile & { access: ModuleAccess };

const NONE = "none";

function roleOptions(module: "asset" | "fleet" | "goa"): Option[] {
  return [
    { value: NONE, label: "Tidak ada akses" },
    ...Object.entries(MODULE_ROLE_LABELS[module]).map(([value, label]) => ({ value, label })),
  ];
}

export function UserFormDialog({
  user,
  companies,
  employees,
  trigger,
}: {
  user?: UserRow;
  companies: Option[];
  employees: Option[];
  trigger: React.ReactNode;
}) {
  const { run } = useAction();
  const [company, setCompany] = useState<string>(user?.company ?? "");
  const [employeeId, setEmployeeId] = useState<string>(user?.employee_id ?? "");
  const [assetRole, setAssetRole] = useState<string>(user?.access.asset?.role ?? NONE);
  const [fleetRole, setFleetRole] = useState<string>(user?.access.fleet?.role ?? NONE);
  const [goaRole, setGoaRole] = useState<string>(user?.access.goa?.role ?? NONE);
  const [perms, setPerms] = useState<MenuPermissions>(user?.access.asset?.permissions ?? DEFAULT_STAFF_PERMISSIONS);

  const access = {
    asset: assetRole === NONE ? null : { role: assetRole, permissions: assetRole === "staff" ? perms : {} },
    fleet: fleetRole === NONE ? null : { role: fleetRole },
    goa: goaRole === NONE ? null : { role: goaRole },
  };

  const togglePerm = (menu: string, action: string, value: boolean) =>
    setPerms((p) => ({ ...p, [menu]: { ...p[menu], [action]: value } }));

  const loginHint = user
    ? isSyntheticEmail(user.email)
      ? `Login dengan NRP (email sistem: ${user.email}).`
      : `Email login: ${user.email}`
    : undefined;

  return (
    <FormDialog
      trigger={trigger}
      title={user ? `Edit akun ${user.name}` : "Tambah akun"}
      description={user ? loginHint : "Password awal demo1234. User bisa menggantinya sendiri di Profil."}
      onSubmit={(fd) => run(() => (user ? updateUser(fd) : createUser(fd)))}
      className="sm:max-w-2xl"
    >
      {user && <input type="hidden" name="id" value={user.id} />}
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="access" value={JSON.stringify(access)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {!user && (
          <Field label="NRP atau email login" htmlFor="u-identifier" required hint="Tanpa email -> dibuat NRP@demo.com.">
            <Input id="u-identifier" name="identifier" required autoComplete="off" />
          </Field>
        )}
        <Field label="Nama" htmlFor="u-name" required>
          <Input id="u-name" name="name" defaultValue={user?.name} required maxLength={120} />
        </Field>
        <Field label="NRP" htmlFor="u-nrp" hint={user ? undefined : "Isi kalau login pakai email tapi punya NRP."}>
          <Input id="u-nrp" name="nrp" defaultValue={user?.nrp ?? ""} maxLength={30} />
        </Field>
        <Field label="Perusahaan" required hint="LOURDES = bisa melihat data GMI dan GIS.">
          <OptionSelect value={company} onValueChange={setCompany} options={companies} placeholder="Pilih PT" />
        </Field>
        <Field label="Data karyawan" className="sm:col-span-2" hint="Hubungkan ke master karyawan (opsional).">
          <OptionSelect
            value={employeeId}
            onValueChange={setEmployeeId}
            options={[{ value: "", label: "Tidak dihubungkan" }, ...employees]}
            placeholder="Pilih karyawan"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_active" defaultChecked={user?.is_active ?? true} />
          Akun aktif
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_moderator" defaultChecked={user?.is_moderator ?? false} />
          Moderator (akses penuh semua modul & PT)
        </label>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">Akses modul</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Asset">
            <OptionSelect value={assetRole} onValueChange={setAssetRole} options={roleOptions("asset")} />
          </Field>
          <Field label="Fleet">
            <OptionSelect value={fleetRole} onValueChange={setFleetRole} options={roleOptions("fleet")} />
          </Field>
          <Field label="GOA">
            <OptionSelect value={goaRole} onValueChange={setGoaRole} options={roleOptions("goa")} />
          </Field>
        </div>

        {assetRole === "staff" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Hak menu Asset (Staff)</th>
                  {ASSET_ACTIONS.map((a) => (
                    <th key={a.key} className="w-16 py-1.5 text-center font-medium">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSET_PERMISSION_MENUS.map((m) => (
                  <tr key={m.key} className="border-t">
                    <td className="py-1.5">{m.label}</td>
                    {ASSET_ACTIONS.map((a) => (
                      <td key={a.key} className="py-1.5 text-center">
                        <Checkbox
                          aria-label={`${m.label} - ${a.label}`}
                          checked={!!perms[m.key]?.[a.key]}
                          onCheckedChange={(v) => togglePerm(m.key, a.key, v === true)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
