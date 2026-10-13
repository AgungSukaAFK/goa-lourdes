import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppModule, ModuleAccess, ModuleRoleMap, Profile } from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  profile: Profile;
  access: ModuleAccess;
};

/** Sesi user saat ini (di-cache per request). null = belum login. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
    supabase.from("module_access").select("module, role, permissions").eq("user_id", userId),
  ]);
  if (!profile) return null;

  const access: ModuleAccess = {};
  for (const row of accessRows ?? []) {
    (access as Record<string, unknown>)[row.module] = {
      role: row.role,
      permissions: row.permissions ?? {},
    };
  }

  return {
    userId,
    email: (claims?.claims?.email as string | undefined) ?? profile.email,
    profile,
    access,
  };
});

/** Wajib login & aktif. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.is_active) redirect("/pending");
  return session;
}

export async function requireModerator(): Promise<Session> {
  const session = await requireSession();
  if (!session.profile.is_moderator) notFound();
  return session;
}

/** Role user di modul (Moderator dianggap role tertinggi). */
export function roleIn<M extends AppModule>(session: Session, module: M): ModuleRoleMap[M] | null {
  if (session.profile.is_moderator) {
    return ({ asset: "admin", fleet: "admin", goa: "supervisor" } as ModuleRoleMap)[module];
  }
  return (session.access[module]?.role as ModuleRoleMap[M] | undefined) ?? null;
}

export function hasModuleAccess(session: Session, module: AppModule) {
  return roleIn(session, module) !== null;
}

/** Wajib punya akses modul (opsional: role tertentu). 404 kalau tidak. */
export async function requireModule<M extends AppModule>(
  module: M,
  roles?: ModuleRoleMap[M][],
): Promise<Session & { role: ModuleRoleMap[M] }> {
  const session = await requireSession();
  const role = roleIn(session, module);
  if (!role || (roles && !roles.includes(role))) notFound();
  return { ...session, role };
}

/** Hak per menu Asset (admin & Moderator selalu boleh). */
export function assetCan(session: Session, menu: string, action: "read" | "write" | "delete") {
  const role = roleIn(session, "asset");
  if (role === "admin") return true;
  if (role !== "staff") return false;
  return !!session.access.asset?.permissions?.[menu]?.[action];
}
