import { requireModule } from "@/lib/auth/session";

export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  await requireModule("fleet");
  return children;
}
