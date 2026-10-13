import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { visibleAdminItems } from "@/lib/modules";

export default async function AdminIndex() {
  const session = await requireSession();
  const first = visibleAdminItems({ isModerator: session.profile.is_moderator, access: session.access })[0];
  if (!first) notFound();
  redirect(first.url);
}
