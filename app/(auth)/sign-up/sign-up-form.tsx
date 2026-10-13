"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BadgeCheck, KeyRound, Loader2, UserRound } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signUp, type AuthState } from "../actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">NRP atau Email</Label>
        <AuthInput id="identifier" name="identifier" icon={BadgeCheck} autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <AuthInput id="name" name="name" icon={UserRound} autoComplete="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <AuthInput
          id="password"
          name="password"
          type="password"
          icon={KeyRound}
          autoComplete="new-password"
          minLength={6}
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
        Daftar
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
