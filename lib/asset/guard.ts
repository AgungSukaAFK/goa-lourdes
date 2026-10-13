import "server-only";
import { notFound } from "next/navigation";
import { assetCan, requireModule } from "@/lib/auth/session";

/** Wajib akses Asset + hak baca menu tertentu (staff mengikuti permission). */
export async function requireAssetMenu(menu: string) {
  const session = await requireModule("asset");
  if (!assetCan(session, menu, "read")) notFound();
  return {
    ...session,
    can: (action: "read" | "write" | "delete", m: string = menu) => assetCan(session, m, action),
    isAdmin: session.role === "admin",
  };
}
