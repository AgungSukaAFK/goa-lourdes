import type { Metadata } from "next";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/session";
import { isSyntheticEmail } from "@/lib/auth/identity";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_LABELS, MODULE_ROLE_LABELS, type AppModule } from "@/lib/types";
import { AvatarForm, NameForm, PasswordForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profil Saya" };

const MODULE_NAMES: Record<AppModule, string> = { asset: "Asset", fleet: "Fleet", goa: "GOA" };

export default async function ProfilePage() {
  const session = await requireSession();
  const { profile, access } = session;
  const supabase = await createClient();
  const [avatar, { data: employee }] = await Promise.all([
    signedUrl("avatars", profile.avatar_path),
    profile.employee_id
      ? supabase.from("employees").select("position, division, site:sites(name)").eq("id", profile.employee_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const emp = employee as { position: string | null; division: string | null; site: { name: string } | null } | null;

  const info: [string, string][] = [
    ["NRP", profile.nrp ?? "-"],
    ["Login", profile.nrp && isSyntheticEmail(profile.email) ? `NRP ${profile.nrp}` : (profile.email ?? "-")],
    ["Perusahaan", profile.company ? COMPANY_LABELS[profile.company] : "-"],
    ["Jabatan", emp?.position ?? "-"],
    ["Site", emp?.site?.name ?? "-"],
  ];

  return (
    <>
      <Content size="md" title="Profil" description="Data akun Anda. NRP & perusahaan hanya bisa diubah admin.">
        <div className="space-y-6">
          <AvatarForm userId={profile.id} name={profile.name} avatar={avatar} />
          <NameForm name={profile.name} />
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Content>
      <Content size="md" title="Akses" description="Modul yang bisa Anda buka.">
        <div className="flex flex-wrap gap-2">
          {profile.is_moderator ? (
            <Badge>Moderator · semua modul</Badge>
          ) : Object.keys(access).length ? (
            (Object.keys(MODULE_NAMES) as AppModule[])
              .filter((m) => access[m])
              .map((m) => (
                <Badge key={m} variant="outline">
                  {MODULE_NAMES[m]} · {(MODULE_ROLE_LABELS[m] as Record<string, string>)[access[m]!.role]}
                </Badge>
              ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada akses modul. Hubungi admin GA.</p>
          )}
        </div>
      </Content>
      <Content title="Ganti password">
        <PasswordForm />
      </Content>
    </>
  );
}
