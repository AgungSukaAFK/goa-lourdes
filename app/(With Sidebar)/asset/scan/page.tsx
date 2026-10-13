import type { Metadata } from "next";
import { Content } from "@/components/content";
import { requireAssetMenu } from "@/lib/asset/guard";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan QR Aset" };

export default async function ScanPage() {
  await requireAssetMenu("assets");
  return (
    <Content title="Scan QR" description="Buka data aset langsung dari label QR-nya.">
      <Scanner />
    </Content>
  );
}
