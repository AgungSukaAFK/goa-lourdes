"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, Loader2, UserRound } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signIn, type AuthState } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined);

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="identifier">Email atau NRP</Label>
        <AuthInput
          id="identifier"
          name="identifier"
          icon={UserRound}
          autoComplete="username"
          placeholder="contoh: 20260101 atau nama@email.com"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <AuthInput
          id="password"
          name="password"
          type="password"
          icon={KeyRound}
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Masuk
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
          Daftar
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Lupa password? Hubungi admin GA untuk reset.
      </p>
    </form>
  );
}
