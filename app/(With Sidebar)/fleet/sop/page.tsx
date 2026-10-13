import type { Metadata } from "next";
import { SopPage } from "@/components/sop/sop-page";
import { requireFleet } from "@/lib/fleet/guard";

export const metadata: Metadata = { title: "SOP Fleet" };

export default async function FleetSopPage() {
  const s = await requireFleet();
  return <SopPage module="fleet" title="SOP Fleet" canEdit={s.isAdmin} />;
}
