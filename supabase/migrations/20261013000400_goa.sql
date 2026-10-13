-- =====================================================================
-- GOA HZ — Modul GOA: task tim GA, template rutin, KPI, safety topic,
-- integrasi P2H mingguan (Fleet) dan penjadwalan pg_cron.
-- =====================================================================

create type public.goa_task_status as enum ('pending', 'in_progress', 'done', 'undone', 'expired');
create type public.goa_sp_level as enum ('none', 'sp1', 'sp2', 'sp3');

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table public.goa_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  title text,
  sp_level public.goa_sp_level not null default 'none',
  sp_date date,
  presence_status text not null default 'hadir' check (presence_status in ('hadir', 'cuti', 'sakit', 'izin', 'dinas')),
  backup_profile_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.goa_categories (
  name text primary key,
  sort integer not null default 0
);

create table public.goa_task_templates (
  id uuid primary key default gen_random_uuid(),
  company public.profile_company not null,
  title text not null,
  description text,
  job_category text,
  -- null = General Pool (boleh diklaim siapa pun di tim)
  assignee_id uuid references public.profiles (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly')),
  -- weekly: 0=Minggu..6=Sabtu; monthly: tanggal 1..31
  days integer[] not null default '{1,2,3,4,5}',
  skip_holidays boolean not null default true,
  due_time time not null default '17:00',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goa_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company public.profile_company not null,
  template_id uuid references public.goa_task_templates (id) on delete set null,
  task_date date,
  title text not null,
  description text,
  type text not null default 'once' check (type in ('once', 'routine')),
  job_category text,
  assignee_id uuid references public.profiles (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  status public.goa_task_status not null default 'pending',
  rating integer check (rating between 1 and 5),
  rated_by uuid references public.profiles (id) on delete set null,
  rated_at timestamptz,
  start_time timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  undone_reason text,
  done_notes text,
  reminder_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'template', 'p2h')),
  source_ref uuid,
  link text,
  created_by uuid references public.profiles (id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, task_date)
);
create index goa_tasks_assignee_idx on public.goa_tasks (assignee_id, status);
create index goa_tasks_status_idx on public.goa_tasks (status, due_at);
create index goa_tasks_created_idx on public.goa_tasks (created_at desc);
create unique index goa_tasks_one_open_p2h on public.goa_tasks (source_ref)
  where source = 'p2h' and status in ('pending', 'in_progress');

create table public.goa_kpi_settings (
  -- 'GLOBAL' atau profile id (override per anggota)
  target text primary key,
  parameters jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.goa_safety_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content_md text not null default '',
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.goa_members for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goa_task_templates for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goa_tasks for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goa_safety_topics for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- View
-- ---------------------------------------------------------------------
create view public.goa_tasks_view
with (security_invoker = true)
as
select
  t.*,
  a.name as assignee_name,
  a.avatar_path as assignee_avatar,
  r.name as reviewer_name,
  c.name as created_by_name,
  (t.status in ('pending', 'in_progress') and t.due_at < now()) as is_overdue
from public.goa_tasks t
left join public.profiles a on a.id = t.assignee_id
left join public.profiles r on r.id = t.reviewer_id
left join public.profiles c on c.id = t.created_by;

-- Anggota tim GOA (profil + akses + data tim)
create view public.goa_team_view
with (security_invoker = true)
as
select
  p.id, p.name, p.nrp, p.company, p.avatar_path, p.is_moderator,
  ma.role,
  m.title, coalesce(m.sp_level, 'none') as sp_level, m.sp_date,
  coalesce(m.presence_status, 'hadir') as presence_status, m.backup_profile_id,
  b.name as backup_name,
  e.join_date, e.position
from public.profiles p
join public.module_access ma on ma.user_id = p.id and ma.module = 'goa'
left join public.goa_members m on m.profile_id = p.id
left join public.profiles b on b.id = m.backup_profile_id
left join public.employees e on e.id = p.employee_id
where p.is_active;

-- ---------------------------------------------------------------------
-- Helper & alur kerja task (security definer + cek eksplisit)
-- ---------------------------------------------------------------------
create or replace function public.goa_is_supervisor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_module_role('goa', array['supervisor']);
$$;

create or replace function public.goa_task_for_update(p_task uuid)
returns public.goa_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks;
begin
  select * into t from public.goa_tasks where id = p_task for update;
  if not found or not public.can_see_company(t.company::text) or not public.has_module_access('goa') then
    raise exception 'Tugas tidak ditemukan.' using errcode = 'P0001';
  end if;
  return t;
end;
$$;
revoke all on function public.goa_task_for_update(uuid) from public, anon;

-- Klaim tugas General Pool / mulai kerjakan tugas sendiri
create or replace function public.goa_start_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks := public.goa_task_for_update(p_task);
begin
  if not public.has_module_role('goa', array['supervisor', 'member']) then
    raise exception 'Guest tidak bisa mengerjakan tugas.' using errcode = '42501';
  end if;
  if t.status <> 'pending' then raise exception 'Tugas sudah dikerjakan / selesai.' using errcode = 'P0001'; end if;
  if t.assignee_id is not null and t.assignee_id <> auth.uid() and not public.goa_is_supervisor() then
    raise exception 'Tugas ini milik anggota lain.' using errcode = '42501';
  end if;
  update public.goa_tasks
  set status = 'in_progress', start_time = now(), assignee_id = coalesce(assignee_id, auth.uid())
  where id = p_task;
end;
$$;

create or replace function public.goa_finish_task(p_task uuid, p_done boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks := public.goa_task_for_update(p_task);
begin
  if t.status not in ('pending', 'in_progress') then raise exception 'Tugas sudah ditutup.' using errcode = 'P0001'; end if;
  if coalesce(t.assignee_id, auth.uid()) <> auth.uid() and not public.goa_is_supervisor() then
    raise exception 'Hanya PIC atau atasan yang bisa menutup tugas ini.' using errcode = '42501';
  end if;
  if not p_done and coalesce(trim(p_note), '') = '' then
    raise exception 'Isi alasan tidak selesai.' using errcode = 'P0001';
  end if;
  update public.goa_tasks
  set status = case when p_done then 'done'::public.goa_task_status else 'undone' end,
      assignee_id = coalesce(assignee_id, auth.uid()),
      start_time = coalesce(start_time, now()),
      completed_at = now(),
      duration_minutes = greatest(0, round(extract(epoch from now() - coalesce(start_time, now())) / 60)),
      done_notes = case when p_done then p_note else done_notes end,
      undone_reason = case when p_done then undone_reason else p_note end
  where id = p_task;
end;
$$;

create or replace function public.goa_rate_task(p_task uuid, p_rating integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks := public.goa_task_for_update(p_task);
begin
  if not (public.goa_is_supervisor() or t.reviewer_id = auth.uid()) then
    raise exception 'Hanya atasan / reviewer yang bisa memberi nilai.' using errcode = '42501';
  end if;
  if t.status <> 'done' then raise exception 'Hanya tugas selesai yang bisa dinilai.' using errcode = 'P0001'; end if;
  if p_rating not between 1 and 5 then raise exception 'Nilai 1-5.' using errcode = 'P0001'; end if;
  update public.goa_tasks set rating = p_rating, rated_by = auth.uid(), rated_at = now() where id = p_task;
end;
$$;

-- Atasan membuka kembali tugas yang sudah ditutup
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
      start_time = null
  where id = p_task;
end;
$$;

-- ---------------------------------------------------------------------
-- Generator & job terjadwal
-- ---------------------------------------------------------------------
create or replace function public.goa_template_runs_on(tpl public.goa_task_templates, d date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select tpl.is_active
    and (not tpl.skip_holidays or not exists (select 1 from public.holidays h where h.date = d))
    and case tpl.frequency
      when 'daily' then true
      when 'weekly' then extract(dow from d)::int = any (tpl.days)
      when 'monthly' then extract(day from d)::int = any (tpl.days)
        -- tanggal 29-31 di bulan pendek -> jalan di hari terakhir bulan
        or (d = (date_trunc('month', d) + interval '1 month - 1 day')::date
            and exists (select 1 from unnest(tpl.days) x where x > extract(day from d)::int))
    end;
$$;

-- Buat task dari template untuk tanggal tertentu (default hari ini WIB).
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
        assignee_id, reviewer_id, due_at, source, created_by
      ) values (
        public.next_doc_code('TSK'), tpl.company, tpl.id, d, tpl.title, tpl.description, 'routine', tpl.job_category,
        tpl.assignee_id, tpl.reviewer_id, (d + tpl.due_time) at time zone 'Asia/Jakarta', 'template', tpl.created_by
      )
      on conflict (template_id, task_date) do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;

-- Task rutin yang belum ditutup sampai hari berganti -> expired ("Hangus").
create or replace function public.goa_expire_tasks()
returns integer
language sql
security definer
set search_path = ''
as $$
  with x as (
    update public.goa_tasks
    set status = 'expired', completed_at = now(), undone_reason = coalesce(undone_reason, 'Hangus: tidak diselesaikan di hari tugas')
    where type = 'routine' and status in ('pending', 'in_progress')
      and task_date < (now() at time zone 'Asia/Jakarta')::date
    returning 1
  )
  select count(*)::int from x;
$$;

-- Fleet -> GOA: task P2H mingguan untuk kendaraan yang jatuh tempo (<= 1 hari)
create or replace function public.goa_generate_p2h_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  v record;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for v in
    select fv.id, fv.plate, fv.model, fv.company,
           (select max(i.next_due_date) from public.fleet_p2h_inspections i where i.vehicle_id = fv.id and i.kind = 'weekly') as due
    from public.fleet_vehicles fv
    where fv.status not in ('inactive')
  loop
    if v.due is null or v.due <= today + 1 then
      insert into public.goa_tasks (code, company, title, description, type, job_category, due_at, source, source_ref, link)
      values (
        public.next_doc_code('TSK'), v.company, 'P2H mingguan ' || v.plate,
        'Lakukan P2H rutin mingguan untuk ' || v.plate || ' (' || v.model || '). Task selesai otomatis setelah P2H disimpan.',
        'once', 'Maintenance Kendaraan', ((coalesce(v.due, today)) + time '17:00') at time zone 'Asia/Jakarta', 'p2h', v.id,
        '/fleet/p2h'
      )
      on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;

-- P2H mingguan tersimpan -> task GOA terkait otomatis selesai.
create or replace function public.goa_close_p2h_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'weekly' then
    update public.goa_tasks
    set status = 'done', completed_at = now(),
        assignee_id = coalesce(assignee_id, new.created_by),
        start_time = coalesce(start_time, now()),
        duration_minutes = coalesce(duration_minutes, 0),
        done_notes = 'Otomatis: ' || new.code || ' (' || new.result || ', skor ' || new.score || ')'
    where source = 'p2h' and source_ref = new.vehicle_id and status in ('pending', 'in_progress');
  end if;
  return new;
end;
$$;
create trigger goa_close_p2h_task after insert on public.fleet_p2h_inspections
  for each row execute function public.goa_close_p2h_task();

-- Notifikasi ke PIC saat ditugaskan
create or replace function public.goa_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.status = 'pending' then
    insert into public.notifications (user_id, company, module, title, body, link, created_by)
    values (new.assignee_id, new.company, 'goa', 'Tugas baru: ' || new.title,
            case when new.due_at is not null then 'Batas: ' || to_char(new.due_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') end,
            '/goa/my-tasks', auth.uid());
  end if;
  return new;
end;
$$;
create trigger goa_notify_assignee after insert or update of assignee_id on public.goa_tasks
  for each row execute function public.goa_notify_assignee();

-- Pengingat dokumen & servis kendaraan -> notifikasi broadcast ke admin Fleet (per company)
create or replace function public.fleet_doc_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  v record;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for v in
    select plate, company,
      array_remove(array[
        case when tax_date between today and today + 30 then 'pajak ' || to_char(tax_date, 'DD-MM-YYYY') end,
        case when tax_date < today then 'pajak LEWAT' end,
        case when kir_date between today and today + 30 then 'KIR ' || to_char(kir_date, 'DD-MM-YYYY') end,
        case when kir_date < today then 'KIR LEWAT' end,
        case when last_service_odo + service_interval_km - odometer <= 500 then 'servis berkala' end
      ], null) as items
    from public.fleet_vehicles where status <> 'inactive'
  loop
    if array_length(v.items, 1) > 0 then
      insert into public.notifications (company, module, title, body, link, expires_at)
      values (v.company, 'fleet', 'Perhatian ' || v.plate, array_to_string(v.items, ' · '), '/fleet/vehicles?doc=due', now() + interval '1 day');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.goa_members enable row level security;
alter table public.goa_categories enable row level security;
alter table public.goa_task_templates enable row level security;
alter table public.goa_tasks enable row level security;
alter table public.goa_kpi_settings enable row level security;
alter table public.goa_safety_topics enable row level security;

create policy "goa_members_select" on public.goa_members for select to authenticated
  using ((select public.has_module_access('goa')));
create policy "goa_members_write" on public.goa_members for all to authenticated
  using ((select public.goa_is_supervisor())) with check ((select public.goa_is_supervisor()));

create policy "goa_categories_select" on public.goa_categories for select to authenticated
  using ((select public.has_module_access('goa')));
create policy "goa_categories_write" on public.goa_categories for all to authenticated
  using ((select public.goa_is_supervisor())) with check ((select public.goa_is_supervisor()));

create policy "goa_templates_select" on public.goa_task_templates for select to authenticated
  using ((select public.has_module_access('goa')) and (select public.can_see_company(company::text)));
create policy "goa_templates_write" on public.goa_task_templates for all to authenticated
  using ((select public.goa_is_supervisor()) and (select public.can_see_company(company::text)))
  with check ((select public.goa_is_supervisor()) and (select public.can_see_company(company::text)));

create policy "goa_tasks_select" on public.goa_tasks for select to authenticated
  using ((select public.has_module_access('goa')) and (select public.can_see_company(company::text)));
-- Atasan bebas membuat; anggota boleh membuat tugas untuk dirinya / General Pool.
create policy "goa_tasks_insert" on public.goa_tasks for insert to authenticated
  with check ((select public.can_see_company(company::text)) and (
    (select public.goa_is_supervisor())
    or ((select public.has_module_role('goa', array['member'])) and (assignee_id is null or assignee_id = (select auth.uid())))
  ));
-- Perubahan status lewat fungsi; update langsung hanya atasan.
create policy "goa_tasks_update" on public.goa_tasks for update to authenticated
  using ((select public.goa_is_supervisor()) and (select public.can_see_company(company::text)));
create policy "goa_tasks_delete" on public.goa_tasks for delete to authenticated
  using ((select public.goa_is_supervisor()) or (created_by = (select auth.uid()) and status = 'pending'));

create policy "goa_kpi_select" on public.goa_kpi_settings for select to authenticated
  using ((select public.has_module_access('goa')));
create policy "goa_kpi_write" on public.goa_kpi_settings for all to authenticated
  using ((select public.goa_is_supervisor())) with check ((select public.goa_is_supervisor()));

create policy "goa_safety_select" on public.goa_safety_topics for select to authenticated
  using ((select public.has_module_access('goa')) and (is_published or (select public.goa_is_supervisor())));
create policy "goa_safety_write" on public.goa_safety_topics for all to authenticated
  using ((select public.goa_is_supervisor())) with check ((select public.goa_is_supervisor()));

alter publication supabase_realtime add table public.goa_tasks;

-- ---------------------------------------------------------------------
-- pg_cron (UTC). WIB = UTC+7.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('goa-generate-routine', '5 17 * * *', $$ select public.goa_generate_routine_tasks(((now() at time zone 'Asia/Jakarta') + interval '1 minute')::date) $$); -- 00:05 WIB
select cron.schedule('goa-expire-tasks', '10 17 * * *', $$ select public.goa_expire_tasks() $$);                                            -- 00:10 WIB
select cron.schedule('goa-p2h-weekly', '0 23 * * *', $$ select public.goa_generate_p2h_tasks() $$);                                         -- 06:00 WIB
select cron.schedule('fleet-doc-reminders', '0 0 * * *', $$ select public.fleet_doc_reminders() $$);                                         -- 07:00 WIB
select cron.schedule('fleet-trip-points-cleanup', '0 19 * * 0', $$ delete from public.fleet_trip_points where recorded_at < now() - interval '180 days' $$);

-- ---------------------------------------------------------------------
-- Data awal
-- ---------------------------------------------------------------------
insert into public.goa_categories (name, sort) values
  ('Mengendarai', 1), ('Cleaning', 2), ('Maintenance Kendaraan', 3), ('Maintenance Building', 4),
  ('Pettycash', 5), ('Support Operasional', 6), ('Administrasi', 7), ('Lainnya', 99)
on conflict do nothing;

insert into public.goa_kpi_settings (target, parameters) values ('GLOBAL', '[
  {"key": "speed", "label": "Ketepatan waktu", "weight": 1},
  {"key": "quality", "label": "Kualitas (rating)", "weight": 2},
  {"key": "done_ratio", "label": "Rasio selesai", "weight": 1},
  {"key": "active_ratio", "label": "Keaktifan", "weight": 1}
]') on conflict do nothing;

insert into public.holidays (date, name) values
  ('2026-01-01', 'Tahun Baru Masehi'), ('2026-01-16', 'Isra Mikraj'), ('2026-02-16', 'Cuti bersama Imlek'),
  ('2026-02-17', 'Tahun Baru Imlek'), ('2026-03-18', 'Cuti bersama Nyepi'), ('2026-03-19', 'Hari Suci Nyepi'),
  ('2026-03-20', 'Cuti bersama Idul Fitri'), ('2026-03-21', 'Idul Fitri'), ('2026-03-22', 'Idul Fitri'),
  ('2026-03-23', 'Cuti bersama Idul Fitri'), ('2026-03-24', 'Cuti bersama Idul Fitri'), ('2026-04-03', 'Wafat Yesus Kristus'),
  ('2026-04-05', 'Paskah'), ('2026-05-01', 'Hari Buruh'), ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-15', 'Cuti bersama'), ('2026-05-27', 'Idul Adha'), ('2026-05-28', 'Cuti bersama Idul Adha'),
  ('2026-05-31', 'Hari Raya Waisak'), ('2026-06-01', 'Hari Lahir Pancasila'), ('2026-06-16', 'Tahun Baru Islam'),
  ('2026-08-17', 'Hari Kemerdekaan RI'), ('2026-08-25', 'Maulid Nabi'), ('2026-12-24', 'Cuti bersama Natal'),
  ('2026-12-25', 'Hari Natal')
on conflict do nothing;

insert into public.goa_safety_topics (title, category, content_md) values
('Kepatuhan sabuk pengaman', 'Berkendara', 'Memakai sabuk pengaman mengurangi risiko cedera fatal hingga **50%** saat terjadi benturan.

- Pasang sabuk sebelum mesin dinyalakan, termasuk penumpang belakang.
- Sabuk melintang di bahu & pinggul, tidak di leher atau perut.
- Laporkan sabuk yang tidak mengunci lewat P2H.'),
('Alat Pelindung Diri (APD)', 'Bongkar muat', 'Helm, rompi reflektif, dan sepatu safety **wajib** dipakai selama bongkar muat.

- Periksa kondisi APD sebelum dipakai.
- Ganti APD yang rusak, jangan dipaksakan.'),
('Inspeksi APAR', 'Kebakaran', 'Pastikan APAR siap pakai:

1. Jarum tekanan di zona **hijau**.
2. Pin pengaman terpasang dan bersegel.
3. Selang tidak retak atau tersumbat.
4. Tanggal isi ulang belum lewat.

Ingat teknik **PASS**: *Pull* (tarik pin), *Aim* (arahkan ke pangkal api), *Squeeze* (tekan tuas), *Sweep* (sapukan).');

insert into public.sop_pages (module, slug, title, sort, content_md) values
('goa', 'alur-tugas', 'Alur tugas tim GA', 1,
'1. Atasan membuat tugas atau template rutin di **Planner**.
2. Tugas tanpa PIC masuk **General Pool** dan bisa diklaim siapa pun di tim.
3. PIC menekan **Mulai** saat mengerjakan, lalu **Selesai** dengan catatan, atau **Tidak selesai** dengan alasan.
4. Tugas rutin yang tidak ditutup sampai pergantian hari otomatis menjadi **Hangus**.
5. Atasan memberi nilai 1–5 untuk tugas selesai. Nilai ini masuk ke KPI kualitas.')
on conflict do nothing;
