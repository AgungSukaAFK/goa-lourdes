"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Ubah hasil scan (URL label atau kode mentah) jadi tujuan di app. */
function targetFor(text: string) {
  const t = text.trim();
  const m = t.match(/\/asset\/(s\/[^?#\s]+|assets\/[0-9a-f-]{36})/i);
  if (m) return `/asset/${m[1]}`;
  return `/asset/s/${encodeURIComponent(t)}`;
}

export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setState("idle");
  };

  const start = async () => {
    setState("starting");
    setError("");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (!result) return;
          controlsRef.current?.stop();
          if (navigator.vibrate) navigator.vibrate(80);
          router.push(targetFor(result.getText()));
        },
      );
      setState("scanning");
    } catch (e) {
      setState("error");
      setError(
        (e as Error).name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser."
          : "Kamera tidak tersedia di perangkat ini.",
      );
    }
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/50 dark:bg-muted/10">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state !== "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === "starting" ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <CameraOff className="size-8 text-muted-foreground opacity-60" />
            )}
            <p className="text-sm text-muted-foreground">{error || "Arahkan kamera ke QR pada label aset."}</p>
          </div>
        )}
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-primary/70" aria-hidden="true" />
        )}
      </div>
      {state === "scanning" ? (
        <Button variant="outline" className="w-full" onClick={stop}>
          <CameraOff />
          Matikan kamera
        </Button>
      ) : (
        <Button className="w-full" onClick={start} disabled={state === "starting"}>
          <Camera />
          Mulai scan
        </Button>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) router.push(targetFor(code));
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Atau ketik kode aset..." className="font-mono" aria-label="Kode aset" />
        <Button type="submit" variant="outline" aria-label="Cari">
          <Search />
        </Button>
      </form>
    </div>
  );
}
