import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { signOut } from "../actions";

export const metadata: Metadata = { title: "Menunggu aktivasi" };

export default async function PendingPage() {
  const session = await getSession();

  return (
    <AuthShell title="Menunggu aktivasi" description="Akun Anda sudah terdaftar tapi belum aktif.">
      <div className="space-y-4 text-center">
        <Clock className="mx-auto size-8 text-muted-foreground" />
        {session && (
          <div className="rounded-lg border bg-muted/50 p-4 text-left text-sm dark:bg-muted/10">
            <p className="font-medium">{session.profile.name}</p>
            <p className="text-muted-foreground">{session.profile.nrp ?? session.profile.email}</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Admin GA akan melengkapi NRP, perusahaan, dan hak akses Anda lalu mengaktifkan akun.
          Setelah itu, muat ulang halaman ini atau masuk kembali.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Keluar
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
