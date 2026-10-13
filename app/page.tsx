import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { accessibleModules } from "@/lib/modules";
import { LAST_MODULE_COOKIE } from "@/lib/supabase/middleware";

/** "/" -> modul terakhir yang dibuka (atau modul pertama yang boleh diakses). */
export default async function Home() {
  const session = await requireSession();
  const modules = accessibleModules({ isModerator: session.profile.is_moderator, access: session.access });
  const last = (await cookies()).get(LAST_MODULE_COOKIE)?.value;
  const target = modules.find((m) => m.id === last) ?? modules[0];
  if (target) redirect(target.basePath);
  redirect(session.profile.is_moderator ? "/admin/users" : "/profile");
}
