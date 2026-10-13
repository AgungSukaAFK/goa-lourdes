import type { Metadata } from "next";
import { Content } from "@/components/content";
import { ActivityList } from "@/components/activity/activity-list";
import { requireAssetMenu } from "@/lib/asset/guard";
import { getCompanyFilter } from "@/lib/company";
import type { SearchParams } from "@/lib/list";
import { ASSET_AUDIT_STATUS, ASSET_REQUEST_STATUS, ASSET_STATUS } from "@/lib/status";

export const metadata: Metadata = { title: "Log Aktivitas Asset" };

const STATUS_LABELS = Object.fromEntries(
  [...Object.entries(ASSET_STATUS), ...Object.entries(ASSET_REQUEST_STATUS), ...Object.entries(ASSET_AUDIT_STATUS)].map(([k, v]) => [k, v.label]),
);

export default async function AssetActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireAssetMenu("config");
  return (
    <Content title="Log Aktivitas" description="Jejak semua perubahan aset, peminjaman, mutasi, dan audit.">
      <ActivityList
        module="asset"
        sp={sp}
        company={await getCompanyFilter(s)}
        statusLabels={STATUS_LABELS}
        entities={[
          { value: "asset", label: "Aset" },
          { value: "loan", label: "Peminjaman" },
          { value: "mutation", label: "Mutasi" },
          { value: "audit", label: "Audit" },
        ]}
      />
    </Content>
  );
}
