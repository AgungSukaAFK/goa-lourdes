import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Masuk ke GOA HZ" description="Gunakan email atau NRP yang terdaftar.">
      <LoginForm next={getSafeNextPath(next) ?? undefined} />
    </AuthShell>
  );
}
