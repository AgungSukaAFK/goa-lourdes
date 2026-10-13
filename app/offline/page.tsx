import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <WifiOff className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">Tidak ada koneksi</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        GOA HZ butuh internet untuk memuat data. Periksa koneksi, lalu coba lagi.
      </p>
    </main>
  );
}
