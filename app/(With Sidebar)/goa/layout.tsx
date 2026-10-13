import { requireModule } from "@/lib/auth/session";

export default async function GoaLayout({ children }: { children: React.ReactNode }) {
  await requireModule("goa");
  return children;
}
