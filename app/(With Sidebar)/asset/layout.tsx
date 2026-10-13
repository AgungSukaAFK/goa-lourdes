import { requireModule } from "@/lib/auth/session";

export default async function AssetLayout({ children }: { children: React.ReactNode }) {
  await requireModule("asset");
  return children;
}
