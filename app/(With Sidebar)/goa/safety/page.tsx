import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Content } from "@/components/content";
import { EmptyState } from "@/components/list/empty-state";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/sop/markdown";
import { requireGoa } from "@/lib/goa/guard";
import { createClient } from "@/lib/supabase/server";
import { SafetyDelete, SafetyDialog } from "./safety-editor";

export const metadata: Metadata = { title: "Safety Topic" };

export default async function SafetyPage() {
  const s = await requireGoa();
  const supabase = await createClient();
  const { data } = await supabase.from("goa_safety_topics").select("*").order("created_at", { ascending: false });
  const topics = data ?? [];
  return (
    <>
      <Content title="Safety Topic" description="Topik keselamatan kerja (K3) untuk tim GA." cardAction={s.isSupervisor ? <SafetyDialog /> : undefined}>
        {!topics.length && <EmptyState icon={ShieldCheck} title="Belum ada topik" />}
      </Content>
      {topics.map((t) => (
        <Content
          key={t.id}
          size="md"
          title={t.title}
          description={t.category ?? undefined}
          cardAction={
            s.isSupervisor ? (
              <div className="flex items-center gap-1">
                {!t.is_published && <Badge variant="secondary">Disembunyikan</Badge>}
                <SafetyDialog topic={t} />
                <SafetyDelete topic={t} />
              </div>
            ) : undefined
          }
        >
          <Markdown>{t.content_md}</Markdown>
        </Content>
      ))}
    </>
  );
}
