"use client";

import { useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-dialog";
import { useAction } from "@/hooks/use-action";
import { getInitials } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload";
import { setMyAvatar, updateMyName } from "./actions";

export function AvatarForm({ userId, name, avatar }: { userId: string; name: string; avatar: string | null }) {
  const { run, pending } = useAction();
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.warning("Pilih file gambar.");
    setUploading(true);
    try {
      const path = await uploadFile("avatars", userId, file);
      await run(() => setMyAvatar(path));
    } catch {
      toast.error("Upload foto gagal.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const busy = uploading || pending;
  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20 rounded-xl">
        {avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}
        <AvatarFallback className="rounded-xl text-lg">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          Ganti foto
        </Button>
        {avatar && (
          <Button variant="ghost" size="sm" onClick={() => run(() => setMyAvatar(null))} disabled={busy}>
            <Trash2 />
            Hapus
          </Button>
        )}
      </div>
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      action={(fd) => {
        run(() => updateMyName(fd));
      }}
    >
      <Field label="Nama tampilan" htmlFor="me-name" className="flex-1">
        <Input id="me-name" name="name" defaultValue={name} required minLength={2} maxLength={120} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Simpan
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const password = String(fd.get("password"));
        if (password.length < 6) return toast.warning("Password minimal 6 karakter.");
        if (password !== fd.get("confirm")) return toast.warning("Konfirmasi password tidak sama.");
        setBusy(true);
        const { error } = await createClient().auth.updateUser({ password });
        setBusy(false);
        if (error) {
          toast.error(/same/i.test(error.message) ? "Password baru sama dengan yang lama." : "Gagal mengganti password.");
        } else {
          toast.success("Password diganti.");
          form.reset();
        }
      }}
    >
      <Field label="Password baru" htmlFor="pw-new">
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Field label="Ulangi password" htmlFor="pw-confirm">
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Ganti password
      </Button>
    </form>
  );
}
