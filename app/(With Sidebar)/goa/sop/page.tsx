import type { Metadata } from "next";
import { SopPage } from "@/components/sop/sop-page";
import { requireGoa } from "@/lib/goa/guard";

export const metadata: Metadata = { title: "SOP GOA" };

export default async function GoaSopPage() {
  const s = await requireGoa();
  return <SopPage module="goa" title="SOP GOA" canEdit={s.isSupervisor} />;
}
