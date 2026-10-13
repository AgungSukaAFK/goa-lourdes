"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COMPANY_FILTER_COOKIE, canSwitchCompany } from "@/lib/company";
import { requireSession } from "@/lib/auth/session";

export async function setCompanyFilter(value: "ALL" | "GMI" | "GIS") {
  const session = await requireSession();
  if (!canSwitchCompany(session)) return;
  const store = await cookies();
  if (value === "ALL") store.delete(COMPANY_FILTER_COOKIE);
  else store.set(COMPANY_FILTER_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
