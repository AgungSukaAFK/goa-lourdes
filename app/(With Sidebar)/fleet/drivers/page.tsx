import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { DocDue } from "@/components/doc-due";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { ACCOUNT_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { DriverDelete, DriverFormDialog, type DriverRow } from "./driver-form";

export const metadata: Metadata = { title: "Driver" };

export default async function DriversPage() {
  const s = await requireFleet(["admin"]);
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  let dq = supabase.from("fleet_drivers_view").select("*").order("name");
  if (filter) dq = dq.in("company", [filter, "LOURDES"]);
  const [{ data: drivers }, { data: links }, { data: vehicles }, { data: emps }, { data: access }] = await Promise.all([
    dq,
    supabase.from("fleet_driver_vehicles").select("driver_id, vehicle_id"),
    supabase.from("fleet_vehicles").select("id, plate, model").neq("status", "inactive").order("plate"),
    supabase.from("employees").select("id, name, nrp").eq("is_active", true).order("name").limit(10000),
    supabase.from("module_access").select("user_id, role").eq("module", "fleet"),
  ]);
  const vehicleOpts = (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.plate} · ${v.model}` }));
  const plate = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));
  const fleetRole = new Map((access ?? []).map((a) => [a.user_id, a.role]));
  const rows: DriverRow[] = (drivers ?? []).map((d) => ({
    ...d,
    vehicle_ids: (links ?? []).filter((l) => l.driver_id === d.id).map((l) => l.vehicle_id),
  }));
  const taken = new Set(rows.map((r) => r.employee_id));
  const empOpts = (emps ?? []).filter((e) => !taken.has(e.id)).map((e) => ({ value: e.id, label: e.name, description: e.nrp }));

  return (
    <Content title="Driver" description="Pengemudi, SIM, dan kendaraan tetapnya." cardAction={<DriverFormDialog employees={empOpts} vehicles={vehicleOpts} />}>
      {rows.length === 0 ? (
        <EmptyState icon={UserRound} title="Belum ada driver" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>SIM</TableHead>
              <TableHead>Berlaku</TableHead>
              <TableHead>Kendaraan tetap</TableHead>
              <TableHead>Akun login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => {
              const role = d.profile_id ? fleetRole.get(d.profile_id) : null;
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.nrp} · {d.company}</div>
                  </TableCell>
                  <TableCell className="text-sm">{[d.license_type, d.license_no].filter(Boolean).join(" · ") || "-"}</TableCell>
                  <TableCell><DocDue date={d.license_expiry} /></TableCell>
                  <TableCell className="font-mono text-xs">{d.vehicle_ids.map((v) => plate.get(v)).filter(Boolean).join(", ") || "-"}</TableCell>
                  <TableCell className="text-xs">
                    {!d.profile_id ? (
                      <span className="text-muted-foreground">Belum ada</span>
                    ) : role === "driver" || role === "admin" ? (
                      <span>Siap ({role})</span>
                    ) : (
                      <span className="text-orange-700 dark:text-orange-300">Role Fleet belum Driver</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge map={ACCOUNT_STATUS} value={d.is_active ? "active" : "inactive"} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <DriverFormDialog driver={d} employees={empOpts} vehicles={vehicleOpts} />
                      <DriverDelete driver={d} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Content>
  );
}
