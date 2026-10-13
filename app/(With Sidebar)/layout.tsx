import { cookies } from "next/headers";
import { NavigationProgress } from "@/components/navigation-progress";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { FontSwitcher } from "@/components/font-switcher";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppBreadcrumb } from "@/components/shell/app-breadcrumb";
import { CompanyFilter } from "@/components/shell/company-filter";
import { CompanyAccent } from "@/components/shell/company-accent";
import { requireSession } from "@/lib/auth/session";
import { canSwitchCompany, getCompanyFilter } from "@/lib/company";
import { signedUrl } from "@/lib/storage";
import { LAST_MODULE_COOKIE } from "@/lib/supabase/middleware";
import type { AppModule } from "@/lib/types";

export default async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const store = await cookies();
  const [filter, avatar] = await Promise.all([
    getCompanyFilter(session),
    signedUrl("avatars", session.profile.avatar_path),
  ]);
  const last = store.get(LAST_MODULE_COOKIE)?.value as AppModule | undefined;
  const { profile } = session;

  return (
    <>
      <NavigationProgress />
      <CompanyAccent company={profile.company} />
      <SidebarProvider>
        <AppSidebar
          className="shadow-lg no-print"
          nav={{ isModerator: profile.is_moderator, access: session.access }}
          lastModule={last ?? null}
          user={{
            name: profile.name,
            subtitle: [profile.nrp ?? profile.email, profile.is_moderator ? "Moderator" : profile.company]
              .filter(Boolean)
              .join(" · "),
            avatar,
          }}
        />
        <SidebarInset>
          <header className="no-print flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <AppBreadcrumb />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canSwitchCompany(session) && <CompanyFilter value={filter} />}
              <div className="hidden items-center sm:flex">
                <AccentThemeSwitcher />
                <FontSwitcher />
              </div>
              <ThemeSwitcher />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid auto-rows-auto grid-cols-12 items-start gap-4 md:gap-6">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
