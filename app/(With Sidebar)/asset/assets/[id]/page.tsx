import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import { requireAssetMenu } from "@/lib/asset/guard";
import { loadAssetOptions } from "@/lib/asset/options";
import { signedUrl } from "@/lib/storage";
import { ASSET_AUDIT_STATUS, ASSET_REQUEST_STATUS, ASSET_STATUS, COMPANY_TONE } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_LABELS } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { AssetRow } from "@/lib/asset/types";
import { AssetDetailActions } from "./asset-actions";

export const metadata: Metadata = { title: "Detail Aset" };

const ACTION_LABEL: Record<string, string> = {
  create: "Dibuat",
  update: "Diubah",
  delete: "Dihapus",
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await requireAssetMenu("assets");
  const supabase = await createClient();

  const { data } = await supabase.from("assets_view").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const asset = data as AssetRow;

  const [photoUrl, options, { data: loans }, { data: muts }, { data: audits }, { data: logs }] = await Promise.all([
    signedUrl("asset-photos", asset.photo_path),
    loadAssetOptions(s),
    supabase.from("asset_loans_view").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
    supabase.from("asset_mutations_view").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
    supabase.from("asset_audits_view").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, action, created_at, entity, summary, actor:profiles(name)")
      .eq("module", "asset")
      .or(`entity_id.eq.${id},data->>asset_id.eq.${id},data->after->>asset_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const qrValue = `${appUrl}/asset/s/${encodeURIComponent(asset.code)}`;
  const deprecPct = asset.cost > 0 ? Math.round(((asset.cost - asset.book_value) / asset.cost) * 100) : 0;

  const info: [string, React.ReactNode][] = [
    ["Kategori", asset.category_name ?? "-"],
    ["Merek / Model", [asset.brand, asset.model].filter(Boolean).join(" · ") || "-"],
    ["Serial number", asset.serial_number ?? "-"],
    ["PT", COMPANY_LABELS[asset.company]],
    ["Site", asset.site_name ?? "-"],
    ["Pemegang (PIC)", asset.owner_name ? `${asset.owner_name} (${asset.owner_nrp})` : "-"],
    ["Tanggal beli", formatDate(asset.purchase_date)],
    ["Dapat dipinjam", asset.is_borrowable ? "Ya" : "Tidak"],
    ["Kode Accurate", asset.accurate_code ?? "-"],
    ["No. MR / PO", [asset.mr_number, asset.po_number].filter(Boolean).join(" / ") || "-"],
  ];

  return (
    <>
      <Content
        title={asset.name}
        description={asset.code}
        cardAction={
          <AssetDetailActions
            asset={asset}
            photoUrl={photoUrl}
            options={options}
            pick={{
              value: asset.id,
              label: `${asset.code} · ${asset.name}`,
              company: asset.company,
              status: asset.status,
              is_borrowable: asset.is_borrowable,
              owner_employee_id: asset.owner_employee_id,
            }}
            perms={{
              write: s.can("write"),
              delete: s.can("delete"),
              loan: s.can("write", "loans"),
              mutate: s.can("write", "mutations"),
              admin: s.isAdmin,
            }}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge map={ASSET_STATUS} value={asset.status} />
              <ToneBadge tone={COMPANY_TONE[asset.company]}>{asset.company}</ToneBadge>
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Harga perolehan</p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(asset.cost)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Nilai buku saat ini</p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(asset.book_value)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tersusutkan ({asset.depreciation_years} th)</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${deprecPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{deprecPct}%</p>
              </div>
            </div>
            {asset.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{asset.notes}</p>}
          </div>
          <div className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/50 dark:bg-muted/10">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={asset.name} className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="size-8 text-muted-foreground opacity-60" />
              )}
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="rounded bg-white p-1.5">
                <QRCodeSVG value={qrValue} size={72} />
              </div>
              <p className="text-xs text-muted-foreground">Scan untuk membuka aset ini di GOA HZ.</p>
            </div>
          </div>
        </div>
      </Content>

      <Content title="Riwayat">
        <Tabs defaultValue="loans">
          <TabsList>
            <TabsTrigger value="loans">Peminjaman ({loans?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="mutations">Mutasi ({muts?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="audits">Audit ({audits?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="logs">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="loans">
            <HistoryTable
              empty="Belum pernah dipinjam."
              head={["No.", "Peminjam", "Pinjam", "Kembali", "Status"]}
              rows={(loans ?? []).map((l) => [
                <span key="c" className="font-mono text-xs">{l.code}</span>,
                l.borrower_name,
                formatDate(l.borrow_date),
                l.actual_return_date ? formatDate(l.actual_return_date) : `Rencana ${formatDate(l.expected_return_date)}`,
                <StatusBadge key="s" map={ASSET_REQUEST_STATUS} value={l.is_overdue ? "overdue" : l.status} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="mutations">
            <HistoryTable
              empty="Belum pernah dimutasi."
              head={["No.", "Dari", "Ke", "Tanggal", "Status"]}
              rows={(muts ?? []).map((m) => [
                <span key="c" className="font-mono text-xs">{m.code}</span>,
                m.from_name ?? "-",
                m.to_name ?? "-",
                formatDate(m.created_at),
                <StatusBadge key="s" map={ASSET_REQUEST_STATUS} value={m.status} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="audits">
            <HistoryTable
              empty="Belum pernah diaudit."
              head={["No.", "Jatuh tempo", "Temuan", "Catatan", "Status"]}
              rows={(audits ?? []).map((a) => [
                <span key="c" className="font-mono text-xs">{a.code}</span>,
                formatDate(a.due_date),
                a.found_condition ? <StatusBadge key="f" map={ASSET_STATUS} value={a.found_condition} /> : "-",
                <span key="n" className="line-clamp-2 text-muted-foreground">{a.notes ?? "-"}</span>,
                <StatusBadge key="s" map={ASSET_AUDIT_STATUS} value={a.is_overdue ? "overdue" : a.status} />,
              ])}
            />
          </TabsContent>
          <TabsContent value="logs">
            <HistoryTable
              empty="Belum ada log."
              head={["Waktu", "Data", "Aksi", "Oleh"]}
              rows={(logs ?? []).map((g) => [
                formatDateTime(g.created_at),
                <Badge key="e" variant="outline" className="text-[11px]">{g.entity}</Badge>,
                g.action.startsWith("status:") ? `Status → ${ASSET_STATUS[g.action.slice(7)]?.label ?? ASSET_REQUEST_STATUS[g.action.slice(7)]?.label ?? g.action.slice(7)}` : (ACTION_LABEL[g.action] ?? g.action),
                (g.actor as unknown as { name: string } | null)?.name ?? "Sistem",
              ])}
            />
          </TabsContent>
        </Tabs>
        <p className="mt-4 text-xs text-muted-foreground">
          Terakhir diubah {formatDateTime(asset.updated_at)} ·{" "}
          <Link href="/asset/assets" className="text-primary hover:underline">
            Kembali ke daftar
          </Link>
        </p>
      </Content>
    </>
  );
}

function HistoryTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => (
              <TableCell key={j}>{c}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
