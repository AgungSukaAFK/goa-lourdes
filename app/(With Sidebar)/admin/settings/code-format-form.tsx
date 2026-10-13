"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-dialog";
import { useAction } from "@/hooks/use-action";
import { buildAssetCode, CODE_TOKENS } from "@/lib/asset/code";
import { saveCodeFormats } from "./actions";

const SAMPLE = {
  siteName: "Head Office",
  categoryName: "IT Hardware",
  purchaseDate: "2026-10-01",
  depreciationYears: 4,
  name: "Laptop Lenovo",
};

export function CodeFormatForm({ initial }: { initial: { GMI: string; GIS: string } }) {
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);

  return (
    <form action={(fd) => void run(() => saveCodeFormats(fd))} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {(["GMI", "GIS"] as const).map((c) => (
          <Field key={c} label={`Format ${c}`} htmlFor={`fmt-${c}`} hint={`Contoh: ${buildAssetCode(v[c] || "{NUM}", { company: c, ...SAMPLE }, 7)}`}>
            <Input
              id={`fmt-${c}`}
              name={c}
              value={v[c]}
              onChange={(e) => setV({ ...v, [c]: e.target.value.toUpperCase() })}
              className="font-mono"
              required
            />
          </Field>
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {CODE_TOKENS.map((t) => (
          <li key={t.token}>
            <code className="font-mono font-medium text-foreground">{t.token}</code> {t.desc}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Simpan format
      </Button>
    </form>
  );
}
