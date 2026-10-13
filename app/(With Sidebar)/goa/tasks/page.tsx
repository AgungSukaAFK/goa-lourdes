import type { Metadata } from "next";
import { Table2 } from "lucide-react";
import { Content } from "@/components/content";
import { ListFilters } from "@/components/list/list-filters";
import { ListPagination } from "@/components/list/list-pagination";
import { EmptyState } from "@/components/list/empty-state";
import { requireGoa } from "@/lib/goa/guard";
import { loadTaskCtx } from "@/lib/goa/context";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm, pageRange, param, sortFrom, type SearchParams } from "@/lib/list";
import { GOA_TASK_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { GoaTask } from "@/lib/goa/types";
import { NewTaskButton } from "../_components/new-task-button";
import { ExportButtons } from "./export-buttons";
import { TaskTable } from "./task-table";

export const metadata: Metadata = { title: "Tabel Tugas" };

const SORTS = { created: { column: "created_at" }, due: { column: "due_at" } };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = await requireGoa();
  const filter = await getCompanyFilter(s);
  const { page, pageSize, from, to } = pageRange(sp, 30);
  const sort = sortFrom(sp, SORTS, "created.desc");
  const q = param(sp, "q");
  const supabase = await createClient();
  let query = supabase.from("goa_tasks_view").select("*", { count: "exact" });
  if (filter) query = query.in("company", [filter, "LOURDES"]);
  if (q) query = query.or(`title.ilike.${ilikeTerm(q)},code.ilike.${ilikeTerm(q)},description.ilike.${ilikeTerm(q)}`);
  const status = param(sp, "status");
  if (status === "overdue") query = query.eq("is_overdue", true);
  else if (status) query = query.eq("status", status);
  const member = param(sp, "member");
  if (member === "pool") query = query.is("assignee_id", null);
  else if (member) query = query.eq("assignee_id", member);
  const category = param(sp, "category");
  if (category) query = query.eq("job_category", category);
  const type = param(sp, "type");
  if (type) query = query.eq("type", type);
  const f = param(sp, "from");
  const t = param(sp, "to");
  if (f) query = query.gte("created_at", `${f}T00:00:00+07:00`);
  if (t) query = query.lte("created_at", `${t}T23:59:59+07:00`);

  const [{ data, count }, { ctx }] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    loadTaskCtx(s, filter),
  ]);
  const rows = (data ?? []) as GoaTask[];

  return (
    <Content title="Tabel Tugas" description="Semua tugas tim dengan filter, nilai, dan export." cardAction={<NewTaskButton ctx={ctx} />}>
      <div className="space-y-4">
        <ListFilters
          searchPlaceholder="Cari judul, kode, deskripsi..."
          actions={<ExportButtons />}
          fields={[
            { type: "select", key: "status", label: "Status", options: Object.entries(GOA_TASK_STATUS).map(([value, d]) => ({ value, label: d.label })) },
            { type: "select", key: "member", label: "PIC", options: [{ value: "pool", label: "General Pool" }, ...ctx.members] },
            { type: "select", key: "category", label: "Kategori", options: ctx.categories.map((c) => ({ value: c, label: c })) },
            { type: "select", key: "type", label: "Tipe", options: [{ value: "once", label: "Sekali" }, { value: "routine", label: "Rutin" }] },
            { type: "date", key: "from", label: "Dibuat dari" },
            { type: "date", key: "to", label: "Dibuat sampai" },
          ]}
        />
        {rows.length === 0 ? <EmptyState icon={Table2} title="Tidak ada tugas" /> : <TaskTable rows={rows} ctx={ctx} />}
        <ListPagination page={page} pageSize={pageSize} total={count ?? 0} />
      </div>
    </Content>
  );
}
