import "server-only";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FleetRole } from "@/lib/types";

/** Akses Fleet (opsional role) + id driver milik user (kalau ada). */
export async function requireFleet(roles?: FleetRole[]) {
  const session = await requireModule("fleet", roles);
  const supabase = await createClient();
  const { data } = await supabase.rpc("fleet_my_driver_id");
  return { ...session, isAdmin: session.role === "admin", myDriverId: (data as string | null) ?? null };
}
