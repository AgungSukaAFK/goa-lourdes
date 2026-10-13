import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";



export default function NotFound() {
  return (
    <main className="col-span-12 flex min-h-[60svh] flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Halaman ini tidak ada, atau akun Anda tidak punya akses ke sana. Hubungi admin GA kalau seharusnya bisa.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
