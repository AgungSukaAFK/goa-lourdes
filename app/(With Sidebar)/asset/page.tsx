import type { Metadata } from "next";
import { AlertTriangle, ArrowLeftRight, ClipboardCheck, Handshake, Package, Wallet } from "lucide-react";
import { Content } from "@/components/content";
import { StatTile } from "@/components/dashboard/stat-tile";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart-card";
import { StatusBreakdown } from "@/components/dashboard/breakdown-list";
import { redirect } from "next/navigation";
import { requireAssetMenu } from "@/lib/asset/guard";
import { assetCan, requireModule } from "@/lib/auth/session";
import { visibleGroups } from "@/lib/modules";
import { getCompanyFilter } from "@/lib/company";
import { ASSET_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_LABELS } from "@/lib/types";
import { formatNumber, formatRupiahShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard Asset" };

type Dash = {
  total: number;
  cost: number;
  book_value: number;
  by_status: Record<string, number>;
  by_company: Record<string, { count: number; value: number }>;
  by_site: { name: string; count: number; value: number }[];
  by_category: { name: string; count: number }[];
  loans_pending: number;
  loans_active: number;
  loans_overdue: number;
  mutations_pending: number;
  audits_waiting: number;
  audits_overdue: number;
};

export default async function AssetDashboard() {
  const session = await requireModule("asset");
  if (!assetCan(session, "dashboard", "read")) {
    const first = visibleGroups({ isModerator: session.profile.is_moderator, access: session.access }, "asset")[0]?.items[0];
    if (first && first.url !== "/asset") redirect(first.url);
  }
  const s = await requireAssetMenu("dashboard");
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  const { data } = await supabase.rpc("asset_dashboard", { p_company: filter });
  const d = data as Dash;
  const shortValue = formatRupiahShort;

  return (
    <>
      <StatTile label="Total aset aktif" value={formatNumber(d.total)} icon={Package} href="/asset/assets" hint={`${formatNumber(d.by_status.ready ?? 0)} ready`} />
      <StatTile label="Nilai buku" value={shortValue(d.book_value)} icon={Wallet} hint={`Perolehan ${shortValue(d.cost)}`} />
      <StatTile
        label="Peminjaman berjalan"
        value={formatNumber(d.loans_active)}
        icon={Handshake}
        href="/asset/loans?status=approved"
        attention={d.loans_overdue > 0 || d.loans_pending > 0}
        hint={
          d.loans_overdue
            ? `${d.loans_overdue} terlambat · ${d.loans_pending} menunggu GA`
            : `${d.loans_pending} menunggu GA`
        }
      />
      <StatTile
        label="Perlu tindakan GA"
        value={formatNumber(d.mutations_pending + d.audits_waiting)}
        icon={d.audits_overdue ? AlertTriangle : ClipboardCheck}
        href={d.mutations_pending ? "/asset/mutations?status=pending" : "/asset/audits?status=waiting"}
        attention={d.audits_overdue > 0}
        hint={`${d.mutations_pending} mutasi · ${d.audits_waiting} audit${d.audits_overdue ? ` (${d.audits_overdue} lewat tempo)` : ""}`}
      />

      {!filter && Object.keys(d.by_company).length > 1 && (
        <Content size="md" title="Per perusahaan" description="Aset aktif & nilai buku.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["GMI", "GIS"] as const).map((c) => (
              <div key={c} className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground">{COMPANY_LABELS[c]}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(d.by_company[c]?.count ?? 0)} aset</p>
                <p className="text-xs text-muted-foreground">{shortValue(d.by_company[c]?.value ?? 0)}</p>
              </div>
            ))}
          </div>
        </Content>
      )}

      <Content size="md" title="Status aset" description="Komposisi kondisi seluruh aset.">
        <StatusBreakdown map={ASSET_STATUS} counts={d.by_status} hrefFor={(st) => `/asset/assets?status=${st}`} />
      </Content>

      <Content size="md" title="Jumlah aset per site" description="10 site dengan aset terbanyak.">
        <HorizontalBarChart label="Aset" data={d.by_site.map((x) => ({ name: x.name, value: x.count }))} />
      </Content>

      <Content size="md" title="Nilai buku per site" description="Total nilai buku aset aktif.">
        <HorizontalBarChart
          label="Nilai buku"
          format="rupiah"
          data={[...d.by_site].sort((a, b) => b.value - a.value).map((x) => ({ name: x.name, value: Number(x.value) }))}
        />
      </Content>

      <Content size="md" title="Aset per kategori">
        <HorizontalBarChart label="Aset" data={d.by_category.map((x) => ({ name: x.name, value: x.count }))} />
      </Content>
    </>
  );
}
