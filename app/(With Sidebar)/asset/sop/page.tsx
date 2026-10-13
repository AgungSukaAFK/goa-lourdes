import type { Metadata } from "next";
import { SopPage } from "@/components/sop/sop-page";
import { requireAssetMenu } from "@/lib/asset/guard";

export const metadata: Metadata = { title: "SOP Asset" };

export default async function AssetSopPage() {
  const s = await requireAssetMenu("sop");
  return <SopPage module="asset" title="SOP Asset" canEdit={s.isAdmin} />;
}
