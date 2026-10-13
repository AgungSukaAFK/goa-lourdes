"use client";

import Link from "next/link";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHead } from "@/components/list/sort-head";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { ASSET_STATUS, COMPANY_TONE } from "@/lib/status";
import { formatCurrency } from "@/lib/utils";
import type { AssetRow } from "@/lib/asset/types";

export function AssetTable({ rows }: { rows: AssetRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm dark:bg-muted/10">
          <span>{selected.length} aset dipilih</span>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`/print/asset-labels?ids=${selected.join(",")}`} target="_blank">
              <Printer />
              Cetak label QR
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Batal
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                aria-label="Pilih semua"
                checked={all}
                onCheckedChange={(v) => setSelected(v === true ? rows.map((r) => r.id) : [])}
              />
            </TableHead>
            <SortHead k="code">Kode</SortHead>
            <SortHead k="name">Nama</SortHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Pemegang</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Status</TableHead>
            <SortHead k="value" defaultDirection="desc" className="text-right">
              Nilai buku
            </SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id} data-state={selected.includes(a.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={`Pilih ${a.code}`} checked={selected.includes(a.id)} onCheckedChange={(v) => toggle(a.id, v === true)} />
              </TableCell>
              <TableCell>
                <Link href={`/asset/assets/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                  {a.code}
                </Link>
                <ToneBadge tone={COMPANY_TONE[a.company]} className="ml-2 text-[10px]">
                  {a.company}
                </ToneBadge>
              </TableCell>
              <TableCell>
                <div className="font-medium">{a.name}</div>
                {(a.brand || a.model) && (
                  <div className="text-xs text-muted-foreground">{[a.brand, a.model].filter(Boolean).join(" · ")}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{a.category_name ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">{a.owner_name ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">{a.site_name ?? "-"}</TableCell>
              <TableCell>
                <StatusBadge map={ASSET_STATUS} value={a.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(a.book_value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
