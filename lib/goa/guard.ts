import "server-only";
import { requireModule } from "@/lib/auth/session";
import type { GoaRole } from "@/lib/types";

export async function requireGoa(roles?: GoaRole[]) {
  const s = await requireModule("goa", roles);
  return { ...s, isSupervisor: s.role === "supervisor", canWork: s.role !== "guest" };
}
