"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarSearch } from "@/components/sidebar-search";
import { ModuleSwitcher } from "./module-switcher";
import {
  accessibleModules,
  adminGroup,
  EXTERNAL_MODULES,
  moduleFromPath,
  navRole,
  visibleAdminItems,
  visibleGroups,
  type NavAccess,
  type NavItem,
} from "@/lib/modules";
import {
  normalizeSearch,
  scoreMenuItem,
  searchMenuItems,
  useSidebarSearch,
} from "@/lib/sidebar/menu-search";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";
import type { AppModule } from "@/lib/types";

type Group = { key: string; label: string; items: NavItem[]; keywords: string[]; hideable: boolean };

/** Tandai item paling spesifik yang cocok dengan pathname (longest match). */
function markActive(items: NavItem[], pathname: string) {
  let best = "";
  for (const i of items) {
    if ((pathname === i.url || pathname.startsWith(i.url + "/")) && i.url.length > best.length) best = i.url;
  }
  return items.map((i) => ({ ...i, isActive: i.url === best }));
}

export function AppSidebar({
  nav,
  lastModule,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  nav: NavAccess;
  lastModule: AppModule | null;
  user: { name: string; subtitle: string; avatar: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery } = useSidebarSearch();
  const searching = normalizeSearch(query) !== "";

  const modules = React.useMemo(
    () => accessibleModules(nav).map((config) => ({ config, role: navRole(nav, config.id)! })),
    [nav],
  );

  // Di halaman non-modul (admin, profil) tetap tampilkan menu modul terakhir.
  const fromPath = moduleFromPath(pathname);
  const active =
    fromPath ??
    (lastModule && modules.some((m) => m.config.id === lastModule) ? lastModule : modules[0]?.config.id ?? null);

  // Saat mencari: semua modul ikut dicari, supaya bisa langsung loncat modul.
  const groups = React.useMemo<Group[]>(() => {
    const list: Group[] = [];
    for (const { config } of modules) {
      if (!searching && config.id !== active) continue;
      for (const g of visibleGroups(nav, config.id)) {
        list.push({
          key: `${config.id}:${g.label}`,
          label: searching ? `${config.name} · ${g.label}` : g.label,
          items: g.items,
          keywords: config.keywords,
          hideable: true,
        });
      }
    }
    const adminItems = visibleAdminItems(nav);
    if (adminItems.length) {
      list.push({ key: "admin", label: adminGroup.label, items: adminItems, keywords: ["admin", "kelola"], hideable: true });
    }
    return list;
  }, [modules, nav, active, searching]);

  const shown = React.useMemo(() => {
    if (!searching) return groups.map((g) => ({ ...g, items: markActive(g.items, pathname) }));
    return groups
      .map((g) => ({ ...g, items: searchMenuItems(g.items, query, g.keywords) }))
      .filter((g) => g.items.length > 0);
  }, [groups, searching, query, pathname]);

  const openTopResult = () => {
    if (!searching) return;
    let best: { url: string; score: number } | null = null;
    for (const g of groups) {
      for (const item of g.items) {
        const score = scoreMenuItem(query, item, g.keywords);
        if (score > 0 && (!best || score > best.score)) best = { url: item.url, score };
      }
    }
    if (!best) return;
    if (best.url !== pathname) setPendingNavUrl(best.url);
    router.push(best.url);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="px-1 pt-1 group-data-[collapsible=icon]:hidden">
          <Image
            src="/lourdes-logo.webp"
            alt="Lourdes Group"
            width={500}
            height={300}
            style={{ width: "100%", height: "auto" }}
            priority
          />
        </div>
        <ModuleSwitcher externals={EXTERNAL_MODULES} modules={modules} active={active} />
      </SidebarHeader>

      <SidebarSearch query={query} onQueryChange={setQuery} onSubmit={openTopResult} />

      <SidebarContent>
        {shown.map((g) => (
          <NavMain
            key={g.key}
            label={g.label}
            storageKey={g.key}
            items={g.items}
            hideable={g.hideable}
            searching={searching}
          />
        ))}

        {searching && shown.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            <SearchX className="h-6 w-6 opacity-60" />
            <p>
              Tidak ada menu untuk &ldquo;
              <span className="font-medium text-foreground">{query}</span>
              &rdquo;
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Hapus pencarian
            </button>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
