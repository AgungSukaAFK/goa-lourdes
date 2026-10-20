-- =====================================================================
-- GOA: jadwal mulai otomatis
-- - goa_tasks.start_at: tugas pending dengan PIC otomatis jadi "Dikerjakan"
--   saat waktunya tiba (cron tiap 5 menit). General Pool tetap menunggu diambil.
-- - goa_task_templates.start_time: jam mulai untuk tugas rutin yang dibuat planner.
-- =====================================================================

alter table public.goa_tasks add column start_at timestamptz;
alter table public.goa_task_templates add column start_time time;

alter table public.goa_tasks add constraint goa_tasks_start_before_due
  check (start_at is null or due_at is null or start_at <= due_at) not valid;
alter table public.goa_task_templates add constraint goa_templates_start_before_due
  check (start_time is null or start_time <= due_time);

create index goa_tasks_auto_start_idx on public.goa_tasks (start_at)
  where status = 'pending' and start_at is not null;

-- t.* di view dibekukan saat dibuat, jadi view dibuat ulang supaya start_at ikut.
drop view public.goa_tasks_view;
create view public.goa_tasks_view
with (security_invoker = true)
as
select
  t.*,
  a.name as assignee_name,
  a.avatar_path as assignee_avatar,
  r.name as reviewer_name,
  c.name as created_by_name,
  (t.status in ('pending', 'in_progress') and t.due_at < now()) as is_overdue,
  (select count(*) from public.goa_task_files f where f.task_id = t.id)::integer as file_count
from public.goa_tasks t
left join public.profiles a on a.id = t.assignee_id
left join public.profiles r on r.id = t.reviewer_id
left join public.profiles c on c.id = t.created_by;
grant select on public.goa_tasks_view to authenticated;

-- Mulai otomatis tugas yang jadwalnya sudah lewat. Durasi dihitung dari jadwal mulai.
create or replace function public.goa_auto_start_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with x as (
    update public.goa_tasks
    set status = 'in_progress', start_time = start_at
    where status = 'pending' and start_at is not null and start_at <= now() and assignee_id is not null
      -- Rutin yang sudah lewat harinya biar dihanguskan goa_expire_tasks, jangan dimulai.
      and (type <> 'routine' or task_date >= (now() at time zone 'Asia/Jakarta')::date)
    returning id, assignee_id, company, title, due_at
  ), notif as (
    insert into public.notifications (user_id, company, module, title, body, link)
    select assignee_id, company, 'goa', 'Tugas dimulai: ' || title,
           case when due_at is not null then 'Batas: ' || to_char(due_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') end,
           '/goa/my-tasks'
    from x
  )
  select count(*)::int into n from x;
  return n;
end;
$$;
revoke all on function public.goa_auto_start_tasks() from public, anon, authenticated;

-- Template rutin: isi start_at dari jam mulai template.
create or replace function public.goa_generate_routine_tasks(p_date date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := coalesce(p_date, (now() at time zone 'Asia/Jakarta')::date);
  n integer := 0;
  tpl public.goa_task_templates;
begin
  -- Bisa dipanggil cron (tanpa user) atau atasan (tombol "Jalankan sekarang").
  if auth.uid() is not null and not public.goa_is_supervisor() then
    raise exception 'Hanya atasan.' using errcode = '42501';
  end if;
  for tpl in select * from public.goa_task_templates where is_active loop
    if public.goa_template_runs_on(tpl, d) then
      insert into public.goa_tasks (
        code, company, template_id, task_date, title, description, type, job_category,
        assignee_id, reviewer_id, start_at, due_at, source, created_by
      ) values (
        public.next_doc_code('TSK'), tpl.company, tpl.id, d, tpl.title, tpl.description, 'routine', tpl.job_category,
        tpl.assignee_id, tpl.reviewer_id,
        case when tpl.start_time is not null then (d + tpl.start_time) at time zone 'Asia/Jakarta' end,
        (d + tpl.due_time) at time zone 'Asia/Jakarta', 'template', tpl.created_by
      )
      on conflict (template_id, task_date) do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;

-- Dibuka kembali: jadwal mulai yang sudah lewat dibuang supaya tidak langsung dimulai lagi oleh cron.
create or replace function public.goa_reopen_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks := public.goa_task_for_update(p_task);
begin
  if not public.goa_is_supervisor() then raise exception 'Hanya atasan.' using errcode = '42501'; end if;
  update public.goa_tasks
  set status = 'pending', completed_at = null, duration_minutes = null, rating = null, rated_by = null, rated_at = null,
      start_time = null, start_at = case when start_at > now() then start_at end
  where id = p_task;
end;
$$;

select cron.schedule('goa-auto-start', '*/5 * * * *', $$ select public.goa_auto_start_tasks() $$);

update public.sop_pages
set content_md = replace(content_md,
  '2. Tugas tanpa PIC masuk **General Pool** dan bisa diklaim siapa pun di tim.',
  '2. Tugas tanpa PIC masuk **General Pool** dan bisa diklaim siapa pun di tim.
   Isi **Jadwal mulai** (tanggal & jam) supaya tugas ber-PIC otomatis berstatus **Dikerjakan** saat waktunya tiba (dicek tiap 5 menit). Untuk tugas rutin, isi **Jam mulai** di template Planner.')
where module = 'goa' and slug = 'alur-tugas';
