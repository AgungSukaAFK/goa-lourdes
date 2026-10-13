import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Content } from "@/components/content";
import { ListFilters } from "@/components/list/list-filters";
import { requireGoa } from "@/lib/goa/guard";
import { loadTaskCtx } from "@/lib/goa/context";
import { getCompanyFilter } from "@/lib/company";
import { param, type SearchParams } from "@/lib/list";
import { createClient } from "@/lib/supabase/server";
import type { GoaTask } from "@/lib/goa/types";
import { TaskCard } from "../_components/task-card";
import { NewTaskButton } from "../_components/new-task-button";

export const metadata: Metadata = { title: "Workflow" };

const COLUMNS = [
  { key: "pending", title: "Pending" },
  { key: "in_progress", title: "Dikerjakan" },
  { key: "done", title: "Selesai" },
  { key: "closed", title: "Tidak selesai / Hangus" },
] as const;

export default async function Board({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireGoa();
  const filter = await getCompanyFilter(s);
  const days = Number(param(sp, "days") || "7");
  const member = param(sp, "member");
  const category = param(sp, "category");
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = await createClient();
  let q = supabase
    .from("goa_tasks_view")
    .select("*")
    .or(`status.in.(pending,in_progress),completed_at.gte.${since}`)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  if (member === "pool") q = q.is("assignee_id", null);
  else if (member) q = q.eq("assignee_id", member);
  if (category) q = q.eq("job_category", category);
  const [{ data }, { ctx }] = await Promise.all([q, loadTaskCtx(s, filter)]);
  const tasks = (data ?? []) as GoaTask[];
  const col = (k: string) => (k === "closed" ? tasks.filter((t) => t.status === "undone" || t.status === "expired") : tasks.filter((t) => t.status === k));

  return (
    <>
      <Content title="Workflow" description="Papan semua tugas tim. Kolom selesai menampilkan periode yang dipilih." cardAction={<NewTaskButton ctx={ctx} />}>
        <ListFilters
          search={false}
          fields={[
            { type: "select", key: "member", label: "PIC", options: [{ value: "pool", label: "General Pool" }, ...ctx.members] },
            { type: "select", key: "category", label: "Kategori", options: ctx.categories.map((c) => ({ value: c, label: c })) },
            {
              type: "select",
              key: "days",
              label: "Periode selesai",
              options: [
                { value: "1", label: "Hari ini" },
                { value: "7", label: "7 hari (default)" },
                { value: "30", label: "30 hari" },
              ],
            },
          ]}
        />
      </Content>
      <div className="col-span-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((c) => {
          const items = col(c.key);
          return (
            <Card key={c.key} className="gap-3 bg-muted/40 py-4 dark:bg-muted/10">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  {c.title}
                  <span className="rounded-full bg-background px-2 text-xs font-medium text-muted-foreground">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[70svh] space-y-2 overflow-y-auto px-4">
                {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Kosong</p>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} ctx={ctx} compact />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
