"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintToolbar() {
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-end gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <p className="mr-auto text-sm text-muted-foreground">Pratinjau cetak (A4)</p>
      <Button variant="outline" size="sm" onClick={() => window.close()}>
        <X />
        Tutup
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer />
        Cetak
      </Button>
    </div>
  );
}
