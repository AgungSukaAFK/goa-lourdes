"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronsUpDown, ImageIcon, LogOut, SquareUserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { MyAlertDialog } from "@/components/dialog-confirm";
import { AvatarViewerDialog } from "@/components/avatar-viewer-dialog";
import { getInitials } from "@/lib/avatar";
import { signOut } from "@/app/(auth)/actions";

export function NavUser({
  user,
}: {
  user: { name: string; subtitle: string; avatar: string | null };
}) {
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [avatarViewer, setAvatarViewer] = useState(false);
  const { isMobile } = useSidebar();

  const avatar = (
    <Avatar className="h-8 w-8 rounded-lg">
      {user.avatar && <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />}
      <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );
  const identity = (
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.subtitle}</span>
    </div>
  );

  return (
    <>
      <MyAlertDialog
        open={logoutDialog}
        onOpenChange={setLogoutDialog}
        title="Keluar dari GOA HZ?"
        description="Anda perlu masuk lagi untuk melanjutkan."
        actionText="Keluar"
        cancelText="Batal"
        onAction={() => signOut()}
      />
      {user.avatar && (
        <AvatarViewerDialog
          open={avatarViewer}
          onOpenChange={setAvatarViewer}
          src={user.avatar}
          name={user.name}
        />
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {avatar}
                {identity}
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  {avatar}
                  {identity}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <SquareUserRound />
                    Profil Saya
                  </Link>
                </DropdownMenuItem>
                {user.avatar && (
                  <DropdownMenuItem onSelect={() => setAvatarViewer(true)}>
                    <ImageIcon />
                    Lihat Foto Profil
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setLogoutDialog(true)}>
                <LogOut />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
