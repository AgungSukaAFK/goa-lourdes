import type { Metadata } from "next";
import { Content } from "@/components/content";
import { requireGoa } from "@/lib/goa/guard";
import { loadTaskCtx } from "@/lib/goa/context";
import { getCompanyFilter } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import type { GoaTask } from "@/lib/goa/types";
import { TaskCard } from "../_components/task-card";
import { NewTaskButton } from "../_components/new-task-button";

export const metadata: Metadata = { title: "Tugas Saya" };

export default async function MyTasks() {
  const s = await requireGoa(["supervisor", "member"]);
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  const startToday = `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}T00:00:00+07:00`;
  let q = supabase
    .from("goa_tasks_view")
    .select("*")
    .or(`assignee_id.eq.${s.userId},assignee_id.is.null`)
    .or(`status.in.(pending,in_progress),completed_at.gte.${startToday}`)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(300);
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  const [{ data }, { ctx }] = await Promise.all([q, loadTaskCtx(s, filter)]);
  const tasks = (data ?? []) as GoaTask[];
  const mine = tasks.filter((t) => t.assignee_id === s.userId);
  const sections = [
    { title: "Sedang dikerjakan", items: mine.filter((t) => t.status === "in_progress") },
    { title: "Menunggu dikerjakan", items: mine.filter((t) => t.status === "pending") },
    { title: "General Pool", desc: "Tugas tanpa PIC. Tekan Ambil untuk mengerjakan.", items: tasks.filter((t) => !t.assignee_id && t.status === "pending") },
    { title: "Ditutup hari ini", items: mine.filter((t) => t.status !== "pending" && t.status !== "in_progress") },
  ];

  return (
    <>
      <Content
        title="Tugas Saya"
        description={`${mine.filter((t) => t.status === "pending" || t.status === "in_progress").length} tugas terbuka · ${mine.filter((t) => t.is_overdue).length} lewat batas`}
        cardAction={<NewTaskButton ctx={ctx} />}
      />
      {sections.map((sec) => (
        <Content key={sec.title} size="md" title={`${sec.title} (${sec.items.length})`} description={sec.desc}>
          {sec.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Kosong.</p>
          ) : (
            <div className="space-y-2">
              {sec.items.map((t) => (
                <TaskCard key={t.id} task={t} ctx={ctx} />
              ))}
            </div>
          )}
        </Content>
      ))}
    </>
  );
}
