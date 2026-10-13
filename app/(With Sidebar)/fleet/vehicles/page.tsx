import type { Metadata } from "next";
import Link from "next/link";
import { CarFront } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { SortHead } from "@/components/list/sort-head";
import { EmptyState } from "@/components/list/empty-state";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { DocDue } from "@/components/doc-due";
import { requireFleet } from "@/lib/fleet/guard";
import { getCompanyFilter } from "@/lib/company";
import { companyOptions } from "@/lib/company-options";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { COMPANY_TONE, FLEET_VEHICLE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";
import type { Vehicle } from "@/lib/fleet/types";
import { VehicleToolbar } from "./vehicle-toolbar";

export const metadata: Metadata = { title: "Kendaraan" };

const SORTS = { plate: { column: "plate" }, odo: { column: "odometer" }, tax: { column: "tax_date" } };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireFleet(["admin"]);
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp);
  const sort = sortFrom(sp, SORTS, "plate.asc");
  const q = param(sp, "q");
  const status = param(sp, "status");
  const doc = param(sp, "doc");

  const supabase = await createClient();
  let query = supabase.from("fleet_vehicles").select("*, site:sites(name)", { count: "exact" });
  if (filter) query = query.eq("company", filter);
  if (q) query = query.or(`plate.ilike.${ilikeTerm(q)},model.ilike.${ilikeTerm(q)},brand.ilike.${ilikeTerm(q)}`);
  if (status) query = query.eq("status", status);
  if (doc === "due") {
    const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    query = query.or(`tax_date.lte.${limit},kir_date.lte.${limit},plate_date.lte.${limit}`);
  }
  const [{ data, count }, { data: sites }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    supabase.from("sites").select("id, name, company").eq("is_active", true).order("name"),
  ]);
  const rows = (data ?? []) as (Vehicle & { site: { name: string } | null })[];
  const siteOpts = (sites ?? []).map((x) => ({ value: x.id, label: x.name, description: x.company, company: x.company as string }));

  return (
    <Content title="Kendaraan" description="Database armada, KM, dan legalitas dokumen.">
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari plat, model, merek..."
          actions={<VehicleToolbar companies={companyOptions(s.profile)} sites={siteOpts} />}
          fields={[
            { type: "select", key: "status", label: "Status", options: Object.entries(FLEET_VEHICLE_STATUS).map(([value, d]) => ({ value, label: d.label })) },
            { type: "select", key: "doc", label: "Dokumen", options: [{ value: "due", label: "Jatuh tempo ≤ 30 hari" }] },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={CarFront} title="Belum ada kendaraan" description="Tambah satu per satu atau import dari Excel." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="plate">Plat</SortHead>
                <TableHead>Model</TableHead>
                <TableHead>Site</TableHead>
                <SortHead k="odo" defaultDirection="desc" className="text-right">KM</SortHead>
                <TableHead className="text-right">Servis berikut</TableHead>
                <SortHead k="tax">Pajak</SortHead>
                <TableHead>KIR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const left = v.last_service_odo + v.service_interval_km - v.odometer;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link href={`/fleet/vehicles/${v.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                        {v.plate}
                      </Link>
                      <ToneBadge tone={COMPANY_TONE[v.company]} className="ml-2 text-[10px]">{v.company}</ToneBadge>
                    </TableCell>
                    <TableCell>
                      {v.model}
                      {(v.brand || v.year) && <div className="text-xs text-muted-foreground">{[v.brand, v.year].filter(Boolean).join(" · ")}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.site?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(v.odometer)}</TableCell>
                    <TableCell className="text-right">
                      <span className={left <= 500 ? "font-medium text-orange-700 dark:text-orange-300" : "text-muted-foreground"}>
                        {left <= 0 ? `Lewat ${formatNumber(-left)} km` : `${formatNumber(left)} km lagi`}
                      </span>
                    </TableCell>
                    <TableCell><DocDue date={v.tax_date} /></TableCell>
                    <TableCell><DocDue date={v.kir_date} /></TableCell>
                    <TableCell><StatusBadge map={FLEET_VEHICLE_STATUS} value={v.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
      </div>
    </Content>
  );
}
