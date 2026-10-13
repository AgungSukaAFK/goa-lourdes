-- =====================================================================
-- GOA HZ — Core: perusahaan, profil, akses modul, karyawan, site,
-- notifikasi, log aktivitas, pengaturan, SOP, hari libur.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------
-- Data transaksi selalu milik GMI atau GIS. LOURDES = induk: dipakai di
-- profil (bisa melihat keduanya) dan master data yang berlaku untuk semua.
create type public.company_code as enum ('GMI', 'GIS');
create type public.profile_company as enum ('GMI', 'GIS', 'LOURDES');
create type public.app_module as enum ('asset', 'fleet', 'goa');

-- ---------------------------------------------------------------------
-- Trigger util
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Master: site & karyawan
-- ---------------------------------------------------------------------
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company public.profile_company not null,
  address text,
  is_active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, company)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  nrp text not null unique,
  name text not null,
  company public.profile_company not null,
  position text,
  division text,
  site_id uuid references public.sites (id) on delete set null,
  join_date date,
  phone text,
  email text,
  photo_path text,
  is_active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_company_idx on public.employees (company);
create index employees_site_idx on public.employees (site_id);

-- ---------------------------------------------------------------------
-- Profil user (1:1 dengan auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_id uuid unique references public.employees (id) on delete set null,
  nrp text unique,
  name text not null,
  email text,
  -- null = baru daftar sendiri, belum dilengkapi Moderator
  company public.profile_company,
  avatar_path text,
  is_active boolean not null default false,
  is_moderator boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_company_idx on public.profiles (company);

create table public.module_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module public.app_module not null,
  role text not null,
  -- Asset: hak per menu { "assets": { "read": true, "write": true, "delete": false }, ... }
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module),
  constraint module_access_role_check check (
    (module = 'asset' and role in ('admin', 'staff'))
    or (module = 'fleet' and role in ('admin', 'driver', 'employee'))
    or (module = 'goa' and role in ('supervisor', 'member', 'guest'))
  )
);

-- ---------------------------------------------------------------------
-- Helper RLS (security definer supaya tidak rekursif ke policy profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_moderator and p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.current_company()
returns public.profile_company
language sql
stable
security definer
set search_path = ''
as $$
  select p.company from public.profiles p where p.id = auth.uid();
$$;

-- Boleh melihat data milik company `c`? (c null / LOURDES = data bersama)
create or replace function public.can_see_company(c text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_active_user() then false
    when public.is_moderator() then true
    when c is null or c = 'LOURDES' then true
    else coalesce(public.current_company()::text in ('LOURDES', c), false)
  end;
$$;

create or replace function public.module_role(m public.app_module)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ma.role
  from public.module_access ma
  join public.profiles p on p.id = ma.user_id
  where ma.user_id = auth.uid() and ma.module = m and p.is_active;
$$;

-- Moderator selalu lolos.
create or replace function public.has_module_role(m public.app_module, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or coalesce(public.module_role(m) = any (roles), false);
$$;

create or replace function public.has_module_access(m public.app_module)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or public.module_role(m) is not null;
$$;

-- Admin di modul mana pun (boleh kelola master karyawan & site).
create or replace function public.is_any_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or exists (
    select 1
    from public.module_access ma
    join public.profiles p on p.id = ma.user_id
    where ma.user_id = auth.uid()
      and p.is_active
      and ma.role in ('admin', 'supervisor')
  );
$$;

-- Hak per menu modul Asset (pengganti hasReadPermission/hasWritePermission lama).
-- Admin Asset & Moderator selalu boleh; Staff mengikuti `permissions`.
create or replace function public.asset_can(menu text, action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or exists (
    select 1
    from public.module_access ma
    join public.profiles p on p.id = ma.user_id
    where ma.user_id = auth.uid()
      and p.is_active
      and ma.module = 'asset'
      and (
        ma.role = 'admin'
        or coalesce((ma.permissions -> menu ->> action)::boolean, false)
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Profil: dibuat otomatis saat user auth dibuat
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, nrp, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'nrp', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- User biasa hanya boleh mengubah nama & avatar profilnya sendiri.
-- Kolom lain (company, status, moderator, NRP) hanya lewat Moderator
-- atau service role (server action User Management).
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_moderator() then
    return new;
  end if;
  if new.company is distinct from old.company
     or new.is_active is distinct from old.is_active
     or new.is_moderator is distinct from old.is_moderator
     or new.nrp is distinct from old.nrp
     or new.employee_id is distinct from old.employee_id
     or new.email is distinct from old.email then
    raise exception 'Tidak boleh mengubah data akun ini.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Harus selalu ada minimal satu Moderator aktif.
create or replace function public.profiles_keep_moderator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.is_moderator and old.is_active)
     or (tg_op = 'UPDATE' and old.is_moderator and old.is_active
         and not (new.is_moderator and new.is_active)) then
    if not exists (
      select 1 from public.profiles
      where is_moderator and is_active and id <> old.id
    ) then
      raise exception 'Minimal harus ada satu Moderator aktif.' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_keep_moderator
  before update or delete on public.profiles
  for each row execute function public.profiles_keep_moderator();

-- ---------------------------------------------------------------------
-- Notifikasi (user_id null = broadcast ke company/modul)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  company public.profile_company,
  module public.app_module,
  title text not null,
  body text,
  link text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_broadcast_idx on public.notifications (created_at desc) where user_id is null;

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ---------------------------------------------------------------------
-- Log aktivitas lintas modul
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  module public.app_module,
  company public.profile_company,
  entity text not null,
  entity_id text,
  action text not null,
  summary text,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_module_idx on public.activity_logs (module, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity, entity_id);

-- ---------------------------------------------------------------------
-- Pengaturan (per company; LOURDES = berlaku umum)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text not null,
  company public.profile_company not null default 'LOURDES',
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (key, company)
);

-- ---------------------------------------------------------------------
-- SOP per modul (markdown, bisa diedit admin modul)
-- ---------------------------------------------------------------------
create table public.sop_pages (
  id uuid primary key default gen_random_uuid(),
  module public.app_module not null,
  slug text not null,
  title text not null,
  content_md text not null default '',
  sort integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module, slug)
);

-- ---------------------------------------------------------------------
-- Hari libur (dipakai task rutin GOA "skip holidays")
-- ---------------------------------------------------------------------
create table public.holidays (
  date date primary key,
  name text not null
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.sites for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.employees for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.module_access for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sop_pages for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.profiles enable row level security;
alter table public.module_access enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.activity_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.sop_pages enable row level security;
alter table public.holidays enable row level security;

-- sites & employees: dibaca sesuai company, dikelola admin modul mana pun
create policy "sites_select" on public.sites for select to authenticated
  using ((select public.can_see_company(company::text)));
create policy "sites_write" on public.sites for all to authenticated
  using ((select public.is_any_admin()) and (select public.can_see_company(company::text)))
  with check ((select public.is_any_admin()) and (select public.can_see_company(company::text)));

create policy "employees_select" on public.employees for select to authenticated
  using ((select public.can_see_company(company::text)));
create policy "employees_write" on public.employees for all to authenticated
  using ((select public.is_any_admin()) and (select public.can_see_company(company::text)))
  with check ((select public.is_any_admin()) and (select public.can_see_company(company::text)));

-- profiles: diri sendiri selalu; rekan sesuai company; Moderator semua
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_moderator())
    or (company is not null and (select public.can_see_company(company::text)))
  );
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_moderator()))
  with check (id = (select auth.uid()) or (select public.is_moderator()));
create policy "profiles_delete" on public.profiles for delete to authenticated
  using ((select public.is_moderator()));

-- module_access: dibaca user aktif (perlu untuk daftar driver, PIC, dll.)
create policy "module_access_select" on public.module_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_user()));
create policy "module_access_write" on public.module_access for all to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

-- notifications
create policy "notifications_select" on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      user_id is null
      and (select public.can_see_company(company::text))
      and (module is null or (select public.has_module_access(module)))
    )
  );
create policy "notifications_insert" on public.notifications for insert to authenticated
  with check ((select public.is_active_user()) and created_by = (select auth.uid()));
create policy "notifications_delete" on public.notifications for delete to authenticated
  using ((select public.is_moderator()) or created_by = (select auth.uid()));

create policy "notification_reads_own" on public.notification_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- activity_logs: ditulis user aktif atas namanya sendiri; dibaca admin modul
create policy "activity_logs_insert" on public.activity_logs for insert to authenticated
  with check ((select public.is_active_user()) and actor_id = (select auth.uid()));
create policy "activity_logs_select" on public.activity_logs for select to authenticated
  using (
    (select public.can_see_company(company::text))
    and (
      (select public.is_moderator())
      or (module is not null and (select public.has_module_role(module, array['admin', 'supervisor'])))
    )
  );

-- app_settings
create policy "app_settings_select" on public.app_settings for select to authenticated
  using ((select public.can_see_company(company::text)));
create policy "app_settings_write" on public.app_settings for all to authenticated
  using ((select public.is_any_admin()) and (select public.can_see_company(company::text)))
  with check ((select public.is_any_admin()) and (select public.can_see_company(company::text)));

-- sop_pages
create policy "sop_pages_select" on public.sop_pages for select to authenticated
  using ((select public.has_module_access(module)));
create policy "sop_pages_write" on public.sop_pages for all to authenticated
  using ((select public.has_module_role(module, array['admin', 'supervisor'])))
  with check ((select public.has_module_role(module, array['admin', 'supervisor'])));

-- holidays
create policy "holidays_select" on public.holidays for select to authenticated
  using ((select public.is_active_user()));
create policy "holidays_write" on public.holidays for all to authenticated
  using ((select public.has_module_role('goa', array['supervisor'])))
  with check ((select public.has_module_role('goa', array['supervisor'])));

-- ---------------------------------------------------------------------
-- Storage: avatar (private, path = {user_id}/{file})
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select public.is_active_user()));
create policy "avatars_write_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_moderator()))
  );
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_moderator()))
  );
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_moderator()))
  );

-- ---------------------------------------------------------------------
-- Realtime: notifikasi
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
