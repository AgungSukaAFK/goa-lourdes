import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { requireModerator } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { AnnouncementDelete, AnnouncementDialog } from "./announcement-client";

export const metadata: Metadata = { title: "Pengumuman" };

const MOD: Record<string, string> = { asset: "Asset", fleet: "Fleet", goa: "GOA" };

export default async function AnnouncementsPage() {
  await requireModerator();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, company, module, created_at, expires_at, link, author:profiles!notifications_created_by_fkey(name)")
    .is("user_id", null)
    .not("created_by", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <Content title="Pengumuman" description="Broadcast ke semua pengguna, per PT, atau per modul." cardAction={<AnnouncementDialog />}>
      {!data?.length ? (
        <EmptyState icon={Megaphone} title="Belum ada pengumuman" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengumuman</TableHead>
              <TableHead>Penerima</TableHead>
              <TableHead>Dikirim</TableHead>
              <TableHead>Berakhir</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-md">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {n.company ?? "Semua PT"} · {n.module ? MOD[n.module] : "semua modul"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateTime(n.created_at)}
                  <div className="text-xs text-muted-foreground">{(n.author as unknown as { name: string } | null)?.name}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(n.expires_at)}</TableCell>
                <TableCell>
                  <AnnouncementDelete id={n.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Content>
  );
}
