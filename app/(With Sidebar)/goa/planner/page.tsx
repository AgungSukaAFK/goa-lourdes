import type { Metadata } from "next";
import { CalendarCog } from "lucide-react";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/list/empty-state";
import { ToneBadge } from "@/components/status-badge";
import { requireGoa } from "@/lib/goa/guard";
import { loadTaskCtx } from "@/lib/goa/context";
import { getCompanyFilter } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { describeSchedule } from "@/lib/goa/schedule";
import { DayDots, RunTodayButton, TemplateActions, TemplateDialog, type Template } from "./planner-client";

export const metadata: Metadata = { title: "Planner Rutin" };

export default async function PlannerPage() {
  const s = await requireGoa(["supervisor"]);
  const filter = await getCompanyFilter(s);
  const supabase = await createClient();
  let q = supabase.from("goa_task_templates").select("*").order("is_active", { ascending: false }).order("title");
  if (filter) q = q.in("company", [filter, "LOURDES"]);
  const [{ data }, { ctx, team }] = await Promise.all([q, loadTaskCtx(s, filter)]);
  const templates = (data ?? []) as Template[];
  const name = new Map(team.map((m) => [m.id, m.name]));

  return (
    <Content
      title="Planner Rutin"
      description="Template yang aktif membuat tugas otomatis setiap hari pukul 00.05 WIB. Blokir template untuk menghentikan sementara."
      cardAction={
        <div className="flex flex-wrap gap-2">
          <RunTodayButton />
          <TemplateDialog members={ctx.members} categories={ctx.categories} companies={ctx.companies} />
        </div>
      }
    >
      {!templates.length ? (
        <EmptyState icon={CalendarCog} title="Belum ada template rutin" description="Contoh: Cek kebersihan toilet lantai 2, setiap Senin–Jumat batas 10.00." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tugas</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} className={t.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.job_category ?? "-"} · {t.company}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {describeSchedule(t)}
                  <DayDots t={t} />
                </TableCell>
                <TableCell>{t.assignee_id ? name.get(t.assignee_id) ?? "-" : <span className="text-muted-foreground">General Pool</span>}</TableCell>
                <TableCell>{t.is_active ? <ToneBadge tone="green">Aktif</ToneBadge> : <ToneBadge tone="gray">Diblokir</ToneBadge>}</TableCell>
                <TableCell>
                  <TemplateActions template={t} members={ctx.members} categories={ctx.categories} companies={ctx.companies} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Content>
  );
}
