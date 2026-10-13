import { BookOpen } from "lucide-react";
import { Content } from "@/components/content";
import { EmptyState } from "@/components/list/empty-state";
import { createClient } from "@/lib/supabase/server";
import type { AppModule } from "@/lib/types";
import { Markdown } from "./markdown";
import { SopDeleteButton, SopEditButton } from "./sop-editor";

/** Halaman SOP per modul. `canEdit` = admin/atasan modul. */
export async function SopPage({ module, title, canEdit }: { module: AppModule; title: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("sop_pages").select("id, title, content_md, sort").eq("module", module).order("sort");
  const pages = data ?? [];

  return (
    <>
      <Content
        title={title}
        description="Prosedur & instruksi kerja yang berlaku."
        cardAction={canEdit ? <SopEditButton module={module} nextSort={(pages.at(-1)?.sort ?? 0) + 1} /> : undefined}
      >
        {pages.length === 0 && <EmptyState icon={BookOpen} title="Belum ada SOP" />}
      </Content>
      {pages.map((p) => (
        <Content
          key={p.id}
          size="md"
          title={p.title}
          cardAction={
            canEdit ? (
              <div className="flex gap-1">
                <SopEditButton module={module} sop={p} />
                <SopDeleteButton module={module} sop={p} />
              </div>
            ) : undefined
          }
        >
          <Markdown>{p.content_md}</Markdown>
        </Content>
      ))}
    </>
  );
}
