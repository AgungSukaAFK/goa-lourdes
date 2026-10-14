"use client";

import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { MODULE_ROLE_LABELS, type AppModule } from "@/lib/types";
import type { ExternalModuleConfig, ModuleConfig } from "@/lib/modules";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";

type Entry = { config: ModuleConfig; role: string };

function roleLabel(module: AppModule, role: string) {
  return (MODULE_ROLE_LABELS[module] as Record<string, string>)[role] ?? role;
}

/** Pindah subsistem (pola TeamSwitcher shadcn). Modul aktif = segmen URL. */
export function ModuleSwitcher({
  externals,
  modules,
  active,
}: {
  /** Web eksternal, tampil paling atas dan tidak pernah aktif. */
  externals: ExternalModuleConfig[];
  modules: Entry[];
  active: AppModule | null;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const current = modules.find((m) => m.config.id === active) ?? null;

  if (modules.length === 0 && externals.length === 0) return null;

  const Icon = current?.config.icon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {Icon ? <Icon className="size-4" /> : <ChevronsUpDown className="size-4" />}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {current ? current.config.name : "Pilih modul"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {current ? `${current.config.description} · ${roleLabel(current.config.id, current.role)}` : "Asset, Fleet, GOA"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Modul</DropdownMenuLabel>
            {externals.map((config, i) => (
              <DropdownMenuItem key={config.id} asChild className="gap-2 p-2">
                <a href={config.href}>
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <config.icon className="size-3.5 shrink-0" />
                  </div>
                  <div className="grid flex-1 leading-tight">
                    <span>{config.name}</span>
                    <span className="text-xs text-muted-foreground">{config.description}</span>
                  </div>
                  <DropdownMenuShortcut>{i + 1}</DropdownMenuShortcut>
                </a>
              </DropdownMenuItem>
            ))}
            {modules.map(({ config, role }, i) => (
              <DropdownMenuItem key={config.id} asChild className="gap-2 p-2">
                <Link
                  href={config.basePath}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    if (config.id !== active) setPendingNavUrl(config.basePath);
                  }}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <config.icon className="size-3.5 shrink-0" />
                  </div>
                  <div className="grid flex-1 leading-tight">
                    <span>{config.name}</span>
                    <span className="text-xs text-muted-foreground">{roleLabel(config.id, role)}</span>
                  </div>
                  {config.id === active ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <DropdownMenuShortcut>{externals.length + i + 1}</DropdownMenuShortcut>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
