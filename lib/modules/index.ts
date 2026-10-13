import type { AppModule } from "@/lib/types";
import { adminGroup } from "./admin";
import { assetModule } from "./asset";
import { fleetModule } from "./fleet";
import { goaModule } from "./goa";
import type { ModuleConfig, NavAccess, NavGroup, NavItem } from "./types";

export const MODULES: ModuleConfig[] = [assetModule, fleetModule, goaModule];

export function getModule(id: AppModule) {
  return MODULES.find((m) => m.id === id)!;
}

/** Modul dari pathname, mis. "/fleet/p2h" -> fleet. */
export function moduleFromPath(pathname: string): AppModule | null {
  const seg = pathname.split("/")[1];
  return MODULES.some((m) => m.id === seg) ? (seg as AppModule) : null;
}

const TOP_ROLE: Record<AppModule, string> = { asset: "admin", fleet: "admin", goa: "supervisor" };

export function navRole(nav: NavAccess, module: AppModule): string | null {
  if (nav.isModerator) return TOP_ROLE[module];
  return nav.access[module]?.role ?? null;
}

export function accessibleModules(nav: NavAccess): ModuleConfig[] {
  return MODULES.filter((m) => navRole(nav, m.id) !== null);
}

function canSeeItem(nav: NavAccess, module: AppModule, item: NavItem): boolean {
  const role = navRole(nav, module);
  if (!role) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  if (module === "asset" && role === "staff" && item.permission) {
    return !!nav.access.asset?.permissions?.[item.permission]?.read;
  }
  return true;
}

/** Grup menu modul yang boleh dilihat user (grup kosong dibuang). */
export function visibleGroups(nav: NavAccess, module: AppModule): NavGroup[] {
  return getModule(module)
    .groups.map((g) => ({ ...g, items: g.items.filter((i) => canSeeItem(nav, module, i)) }))
    .filter((g) => g.items.length > 0);
}

export function isAnyAdmin(nav: NavAccess) {
  if (nav.isModerator) return true;
  return Object.values(nav.access).some((a) => a && (a.role === "admin" || a.role === "supervisor"));
}

export function visibleAdminItems(nav: NavAccess): NavItem[] {
  return adminGroup.items.filter((i) =>
    i.roles?.includes("moderator") ? nav.isModerator : isAnyAdmin(nav),
  );
}

/** Judul menu untuk breadcrumb (null kalau tidak ada di config). */
export function titleForUrl(url: string): string | null {
  for (const m of MODULES) {
    if (m.basePath === url) return m.name;
    for (const g of m.groups) for (const i of g.items) if (i.url === url) return i.title;
  }
  for (const i of adminGroup.items) if (i.url === url) return i.title;
  return null;
}

export { adminGroup };
export type { ModuleConfig, NavAccess, NavGroup, NavItem };
