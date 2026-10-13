import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardCheck } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { requireFleet } from "@/lib/fleet/guard";
import { getCostSettings, loadFleetOptions } from "@/lib/fleet/server";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { FLEET_BOOKING_STATUS, FLEET_P2H_RESULT } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BookingFormDialog } from "./booking-form";

export const metadata: Metadata = { title: "Booking Unit" };

const SORTS = { start: { column: "start_time" }, created: { column: "created_at" }, code: { column: "code" } };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireFleet();
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "start.desc");
  const q = param(sp, "q");
  const status = param(sp, "status");
  const scope = param(sp, "scope") || (s.isAdmin ? "" : s.role === "driver" ? "trips" : "mine");
  const date = param(sp, "date");

  const supabase = await createClient();
  let query = supabase.from("fleet_bookings_view").select("*", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`code.ilike.${t},vehicle_plate.ilike.${t},requester_name.ilike.${t},driver_name.ilike.${t},destination.ilike.${t}`);
  }
  if (status) query = query.eq("status", status);
  if (scope === "mine") query = query.eq("requested_by", s.userId);
  if (scope === "trips") query = s.myDriverId ? query.eq("driver_id", s.myDriverId) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  if (date) query = query.lte("start_time", `${date}T23:59:59+07:00`).gte("end_time", `${date}T00:00:00+07:00`);

  const [{ data, count }, options, cost] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    loadFleetOptions(),
    getCostSettings(),
  ]);

  const scopeOptions = [
    { value: "mine", label: "Pengajuan saya" },
    ...(s.myDriverId ? [{ value: "trips", label: "Tugas saya (driver)" }] : []),
    ...(s.isAdmin ? [] : [{ value: "all", label: "Semua (jadwal)" }]),
  ];

  return (
    <Content
      title="Booking Unit"
      description="Pengajuan → persetujuan GA → P2H → perjalanan (GPS) → selesai."
      cardAction={
        <BookingFormDialog
          vehicles={options.vehicles}
          employees={options.employees}
          drivers={options.drivers}
          cost={cost}
          isAdmin={s.isAdmin}
          myEmployeeId={s.profile.employee_id}
        />
      }
    >
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari no., plat, pemohon, driver, tujuan..."
          fields={[
            { type: "select", key: "status", label: "Status", options: Object.entries(FLEET_BOOKING_STATUS).map(([value, d]) => ({ value, label: d.label })) },
            { type: "select", key: "scope", label: "Tampilkan", options: scopeOptions },
            { type: "date", key: "date", label: "Tanggal" },
          ]}
        />
        {!data?.length ? (
          <EmptyState icon={CalendarClock} title="Belum ada booking" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="code">No.</SortHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Pemohon / Driver</TableHead>
                <SortHead k="start" defaultDirection="desc">Jadwal</SortHead>
                <TableHead>Tujuan</TableHead>
                <TableHead>P2H</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/fleet/bookings/${b.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {b.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{b.vehicle_plate}</div>
                    <div className="text-xs text-muted-foreground">{b.vehicle_model}</div>
                  </TableCell>
                  <TableCell>
                    {b.requester_name ?? "-"}
                    <div className="text-xs text-muted-foreground">Driver: {b.driver_name ?? "belum ditentukan"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(b.start_time)}
                    <div className="text-xs text-muted-foreground">s/d {formatDateTime(b.end_time)}</div>
                  </TableCell>
                  <TableCell className="max-w-[14rem]">
                    <div className="truncate">{b.destination ?? "-"}</div>
                    {b.est_cost && <div className="text-xs text-muted-foreground">Est. {formatCurrency(b.est_cost)}</div>}
                  </TableCell>
                  <TableCell>
                    {b.p2h_result ? (
                      <StatusBadge map={FLEET_P2H_RESULT} value={b.p2h_result} />
                    ) : b.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300">
                        <ClipboardCheck className="size-3.5" /> Belum
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={FLEET_BOOKING_STATUS} value={b.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
      </div>
    </Content>
  );
}
