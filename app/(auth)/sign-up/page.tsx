import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Daftar" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Daftar akun"
      description="Akun baru perlu diaktifkan admin GA sebelum bisa dipakai."
    >
      <SignUpForm />
    </AuthShell>
  );
}
