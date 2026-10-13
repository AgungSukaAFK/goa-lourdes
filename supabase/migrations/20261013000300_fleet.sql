-- =====================================================================
-- GOA HZ — Modul Fleet: kendaraan, driver, booking + GPS, P2H (gabungan
-- Fleet & GOA lama), perbaikan, part & prediksi servis, BBM.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------
create type public.fleet_vehicle_status as enum ('available', 'in_use', 'grounded', 'maintenance', 'inactive');
create type public.fleet_booking_status as enum ('pending', 'approved', 'in_use', 'completed', 'rejected', 'cancelled');
create type public.fleet_p2h_kind as enum ('pre_trip', 'weekly');
create type public.fleet_p2h_result as enum ('fit', 'caution', 'grounded');
create type public.fleet_repair_status as enum ('queued', 'in_progress', 'done', 'cancelled');
create type public.fleet_part_type as enum ('km', 'days');

-- ---------------------------------------------------------------------
-- Master
-- ---------------------------------------------------------------------
create table public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  model text not null,
  brand text,
  year integer,
  company public.company_code not null,
  site_id uuid references public.sites (id) on delete set null,
  odometer integer not null default 0 check (odometer >= 0),
  service_interval_km integer not null default 5000 check (service_interval_km > 0),
  last_service_odo integer not null default 0,
  tax_date date,
  kir_date date,
  plate_date date,
  status public.fleet_vehicle_status not null default 'available',
  photo_path text,
  notes text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fleet_vehicles_company_idx on public.fleet_vehicles (company);

create table public.fleet_odometer_logs (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  odometer integer not null check (odometer >= 0),
  source text not null check (source in ('p2h', 'fuel', 'trip', 'manual', 'service', 'import')),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index fleet_odometer_logs_vehicle_idx on public.fleet_odometer_logs (vehicle_id, recorded_at);

create table public.fleet_drivers (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  company public.profile_company not null,
  license_no text,
  license_type text,
  license_expiry date,
  is_active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fleet_driver_vehicles (
  driver_id uuid not null references public.fleet_drivers (id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  primary key (driver_id, vehicle_id)
);

create table public.fleet_inspectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_id uuid references public.employees (id) on delete set null,
  company public.profile_company not null default 'LOURDES',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fleet_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.fleet_part_type not null default 'km',
  -- km: interval kilometer; days: interval hari
  interval integer not null check (interval > 0),
  cost numeric(14, 2) not null default 0,
  -- null = berlaku untuk semua kendaraan
  vehicle_ids uuid[],
  -- untuk type=days: ikut tanggal dokumen kendaraan
  date_source text check (date_source in ('tax_date', 'kir_date', 'plate_date')),
  is_active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fleet_service_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  part_id uuid references public.fleet_parts (id) on delete set null,
  repair_id uuid,
  odometer integer,
  serviced_at date not null default (now() at time zone 'Asia/Jakarta')::date,
  cost numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index fleet_service_logs_vehicle_idx on public.fleet_service_logs (vehicle_id, part_id, serviced_at desc);

-- ---------------------------------------------------------------------
-- Booking & GPS
-- ---------------------------------------------------------------------
create table public.fleet_bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company public.company_code not null,
  requester_employee_id uuid references public.employees (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  vehicle_id uuid not null references public.fleet_vehicles (id),
  driver_id uuid references public.fleet_drivers (id) on delete set null,
  purpose text not null,
  destination text,
  dest_lat double precision,
  dest_lng double precision,
  start_time timestamptz not null,
  end_time timestamptz not null,
  est_distance_km numeric(10, 2),
  est_cost numeric(14, 2),
  status public.fleet_booking_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  p2h_override boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  start_odo integer,
  end_odo integer,
  gps_distance_km numeric(10, 2),
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  -- Satu kendaraan tidak boleh dipakai dua booking yang waktunya bentrok.
  constraint fleet_bookings_no_overlap exclude using gist (
    vehicle_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('approved', 'in_use'))
);
create index fleet_bookings_vehicle_idx on public.fleet_bookings (vehicle_id, start_time);
create index fleet_bookings_status_idx on public.fleet_bookings (status);
create index fleet_bookings_driver_idx on public.fleet_bookings (driver_id);

create table public.fleet_trip_points (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.fleet_bookings (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed double precision,
  accuracy double precision,
  heading double precision,
  recorded_at timestamptz not null default now()
);
create index fleet_trip_points_booking_idx on public.fleet_trip_points (booking_id, recorded_at);

-- ---------------------------------------------------------------------
-- P2H
-- ---------------------------------------------------------------------
create table public.fleet_p2h_items (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('vehicle', 'driver')),
  category text not null,
  name text not null,
  description text,
  weight integer not null default 2 check (weight between 0 and 100),
  is_critical boolean not null default false,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fleet_p2h_inspections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company public.company_code not null,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  driver_id uuid references public.fleet_drivers (id) on delete set null,
  booking_id uuid references public.fleet_bookings (id) on delete set null,
  kind public.fleet_p2h_kind not null,
  inspector_name text,
  odometer integer not null,
  score integer not null,
  result public.fleet_p2h_result not null,
  answers jsonb not null default '[]'::jsonb,
  issues text[] not null default '{}',
  notes text,
  lat double precision,
  lng double precision,
  next_due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now()
);
create index fleet_p2h_vehicle_idx on public.fleet_p2h_inspections (vehicle_id, created_at desc);
create index fleet_p2h_booking_idx on public.fleet_p2h_inspections (booking_id);

create table public.fleet_p2h_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.fleet_p2h_inspections (id) on delete cascade,
  side text not null check (side in ('front', 'back', 'left', 'right', 'other')),
  path text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perbaikan
-- ---------------------------------------------------------------------
create table public.fleet_repairs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company public.company_code not null,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  inspection_id uuid references public.fleet_p2h_inspections (id) on delete set null,
  component text not null,
  description text,
  is_critical boolean not null default false,
  status public.fleet_repair_status not null default 'queued',
  reported_by_name text,
  reported_by uuid references public.profiles (id) on delete set null,
  mechanic text,
  workshop text,
  estimated_cost numeric(14, 2),
  actual_cost numeric(14, 2),
  started_at timestamptz,
  done_at timestamptz,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fleet_repairs_vehicle_idx on public.fleet_repairs (vehicle_id, status);
alter table public.fleet_service_logs
  add constraint fleet_service_logs_repair_fk foreign key (repair_id) references public.fleet_repairs (id) on delete set null;

-- ---------------------------------------------------------------------
-- BBM
-- ---------------------------------------------------------------------
create table public.fleet_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  company public.company_code not null,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  driver_id uuid references public.fleet_drivers (id) on delete set null,
  date date not null,
  start_odo integer not null,
  end_odo integer not null,
  liters numeric(10, 2) not null check (liters > 0),
  total_cost numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now(),
  check (end_odo > start_odo)
);
create index fleet_fuel_vehicle_idx on public.fleet_fuel_logs (vehicle_id, date desc);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.fleet_vehicles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fleet_drivers for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fleet_parts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fleet_bookings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fleet_repairs for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------
-- Driver milik user yang login (via profiles.employee_id).
create or replace function public.fleet_my_driver_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.fleet_drivers d
  join public.profiles p on p.employee_id = d.employee_id
  where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.fleet_is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_module_role('fleet', array['admin']);
$$;

-- Jarak dua titik (km)
create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------
create view public.fleet_drivers_view
with (security_invoker = true)
as
select d.*, e.nrp, e.name, e.phone, e.position, p.id as profile_id
from public.fleet_drivers d
join public.employees e on e.id = d.employee_id
left join public.profiles p on p.employee_id = d.employee_id;

create view public.fleet_bookings_view
with (security_invoker = true)
as
select
  b.*,
  v.plate as vehicle_plate,
  v.model as vehicle_model,
  re.name as requester_name,
  re.nrp as requester_nrp,
  re.division as requester_division,
  de.name as driver_name,
  de.nrp as driver_nrp,
  dp.id as driver_profile_id,
  (select i.id from public.fleet_p2h_inspections i where i.booking_id = b.id order by i.created_at desc limit 1) as p2h_id,
  (select i.result from public.fleet_p2h_inspections i where i.booking_id = b.id order by i.created_at desc limit 1) as p2h_result
from public.fleet_bookings b
join public.fleet_vehicles v on v.id = b.vehicle_id
left join public.employees re on re.id = b.requester_employee_id
left join public.fleet_drivers d on d.id = b.driver_id
left join public.employees de on de.id = d.employee_id
left join public.profiles dp on dp.employee_id = d.employee_id;

create view public.fleet_p2h_view
with (security_invoker = true)
as
select
  i.*,
  v.plate as vehicle_plate,
  v.model as vehicle_model,
  e.name as driver_name,
  e.nrp as driver_nrp,
  b.code as booking_code,
  cp.name as created_by_name
from public.fleet_p2h_inspections i
join public.fleet_vehicles v on v.id = i.vehicle_id
left join public.fleet_drivers d on d.id = i.driver_id
left join public.employees e on e.id = d.employee_id
left join public.fleet_bookings b on b.id = i.booking_id
left join public.profiles cp on cp.id = i.created_by;

create view public.fleet_repairs_view
with (security_invoker = true)
as
select r.*, v.plate as vehicle_plate, v.model as vehicle_model, i.code as inspection_code
from public.fleet_repairs r
join public.fleet_vehicles v on v.id = r.vehicle_id
left join public.fleet_p2h_inspections i on i.id = r.inspection_id;

create view public.fleet_fuel_view
with (security_invoker = true)
as
select
  f.*,
  v.plate as vehicle_plate,
  v.model as vehicle_model,
  e.name as driver_name,
  (f.end_odo - f.start_odo) as distance_km,
  round((f.end_odo - f.start_odo) / f.liters, 2) as km_per_liter,
  case when f.end_odo > f.start_odo then round(f.total_cost / (f.end_odo - f.start_odo), 0) end as cost_per_km,
  case
    when (f.end_odo - f.start_odo) / f.liters >= 15 then 'very_efficient'
    when (f.end_odo - f.start_odo) / f.liters >= 10 then 'efficient'
    when (f.end_odo - f.start_odo) / f.liters >= 7 then 'fair'
    else 'wasteful'
  end as rating
from public.fleet_fuel_logs f
join public.fleet_vehicles v on v.id = f.vehicle_id
left join public.fleet_drivers d on d.id = f.driver_id
left join public.employees e on e.id = d.employee_id;

-- Rata-rata km/hari per kendaraan (90 hari terakhir) untuk prediksi servis.
create view public.fleet_vehicle_usage
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  count(l.id) as samples,
  case
    when count(l.id) >= 2 and max(l.recorded_at) > min(l.recorded_at)
      then greatest(0, (max(l.odometer) - min(l.odometer))::numeric /
        greatest(1, extract(epoch from max(l.recorded_at) - min(l.recorded_at)) / 86400))
  end as avg_km_per_day
from public.fleet_vehicles v
left join public.fleet_odometer_logs l on l.vehicle_id = v.id and l.recorded_at > now() - interval '90 days'
group by v.id;

-- ---------------------------------------------------------------------
-- Alur kerja
-- ---------------------------------------------------------------------
create or replace function public.fleet_log_odometer(p_vehicle uuid, p_odo integer, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_module_role('fleet', array['admin', 'driver']) then
    raise exception 'Tidak punya akses mencatat KM.' using errcode = '42501';
  end if;
  insert into public.fleet_odometer_logs (vehicle_id, odometer, source, recorded_by)
  values (p_vehicle, p_odo, p_source, auth.uid());
  update public.fleet_vehicles set odometer = greatest(odometer, p_odo) where id = p_vehicle;
end;
$$;
revoke all on function public.fleet_log_odometer(uuid, integer, text) from public, anon;
grant execute on function public.fleet_log_odometer(uuid, integer, text) to authenticated;

-- Setujui / tolak booking (admin). Driver bisa ditentukan saat setuju.
create or replace function public.fleet_decide_booking(p_booking uuid, p_approve boolean, p_driver uuid default null, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  b public.fleet_bookings;
begin
  if not public.fleet_is_admin() then
    raise exception 'Hanya admin Fleet yang bisa memproses booking.' using errcode = '42501';
  end if;
  select * into b from public.fleet_bookings where id = p_booking for update;
  if not found then raise exception 'Booking tidak ditemukan.' using errcode = 'P0001'; end if;
  if b.status <> 'pending' then raise exception 'Booking sudah diproses.' using errcode = 'P0001'; end if;
  if p_approve and exists (select 1 from public.fleet_vehicles where id = b.vehicle_id and status in ('grounded', 'maintenance', 'inactive')) then
    raise exception 'Kendaraan sedang tidak layak / perawatan.' using errcode = 'P0001';
  end if;

  begin
    update public.fleet_bookings
    set status = case when p_approve then 'approved'::public.fleet_booking_status else 'rejected' end,
        driver_id = coalesce(p_driver, driver_id),
        decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_booking;
  exception when exclusion_violation then
    raise exception 'Jadwal bentrok dengan booking lain untuk kendaraan ini.' using errcode = 'P0001';
  end;
end;
$$;

-- Mulai perjalanan: wajib ada P2H pre-trip yang tidak GROUNDED (kecuali override admin).
create or replace function public.fleet_start_trip(p_booking uuid, p_odo integer default null, p_override boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.fleet_bookings;
  v_p2h public.fleet_p2h_inspections;
  v_admin boolean := public.fleet_is_admin();
begin
  select * into b from public.fleet_bookings where id = p_booking for update;
  if not found or not public.can_see_company(b.company::text) then raise exception 'Booking tidak ditemukan.' using errcode = 'P0001'; end if;
  if not v_admin and (b.driver_id is null or b.driver_id is distinct from public.fleet_my_driver_id()) then
    raise exception 'Hanya driver booking ini yang bisa memulai perjalanan.' using errcode = '42501';
  end if;
  if b.status <> 'approved' then raise exception 'Booking belum disetujui atau sudah berjalan.' using errcode = 'P0001'; end if;

  select * into v_p2h from public.fleet_p2h_inspections where booking_id = p_booking order by created_at desc limit 1;
  if v_p2h.id is null and not (p_override and v_admin) then
    raise exception 'Isi P2H dulu sebelum berangkat.' using errcode = 'P0001';
  end if;
  if v_p2h.result = 'grounded' and not (p_override and v_admin) then
    raise exception 'Hasil P2H: TIDAK LAYAK JALAN. Kendaraan tidak boleh berangkat.' using errcode = 'P0001';
  end if;

  update public.fleet_bookings
  set status = 'in_use', started_at = now(),
      start_odo = coalesce(p_odo, v_p2h.odometer, (select odometer from public.fleet_vehicles where id = b.vehicle_id)),
      p2h_override = (p_override and v_admin)
  where id = p_booking;
  update public.fleet_vehicles set status = 'in_use' where id = b.vehicle_id and status = 'available';
end;
$$;

-- Selesai perjalanan: catat KM akhir & jarak GPS.
create or replace function public.fleet_finish_trip(p_booking uuid, p_end_odo integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.fleet_bookings;
  v_dist double precision;
begin
  select * into b from public.fleet_bookings where id = p_booking for update;
  if not found or not public.can_see_company(b.company::text) then raise exception 'Booking tidak ditemukan.' using errcode = 'P0001'; end if;
  if not public.fleet_is_admin() and (b.driver_id is null or b.driver_id is distinct from public.fleet_my_driver_id()) then
    raise exception 'Hanya driver booking ini yang bisa menyelesaikan perjalanan.' using errcode = '42501';
  end if;
  if b.status <> 'in_use' then raise exception 'Perjalanan belum dimulai.' using errcode = 'P0001'; end if;
  if b.start_odo is not null and p_end_odo < b.start_odo then
    raise exception 'KM akhir lebih kecil dari KM awal (%).', b.start_odo using errcode = 'P0001';
  end if;

  select coalesce(sum(public.haversine_km(lat, lng, nlat, nlng)), 0) into v_dist
  from (
    select lat, lng, lead(lat) over w as nlat, lead(lng) over w as nlng
    from public.fleet_trip_points where booking_id = p_booking
    window w as (order by recorded_at)
  ) t
  where nlat is not null;

  update public.fleet_bookings
  set status = 'completed', finished_at = now(), end_odo = p_end_odo, gps_distance_km = round(v_dist::numeric, 2)
  where id = p_booking;
  perform public.fleet_log_odometer(b.vehicle_id, p_end_odo, 'trip');
  update public.fleet_vehicles set status = 'available' where id = b.vehicle_id and status = 'in_use';
end;
$$;

-- Batalkan booking (pemohon / admin) selama belum berjalan.
create or replace function public.fleet_cancel_booking(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.fleet_bookings;
begin
  select * into b from public.fleet_bookings where id = p_booking for update;
  if not found or not public.can_see_company(b.company::text) then raise exception 'Booking tidak ditemukan.' using errcode = 'P0001'; end if;
  if not public.fleet_is_admin() and b.requested_by is distinct from auth.uid() then
    raise exception 'Hanya pemohon atau admin yang bisa membatalkan.' using errcode = '42501';
  end if;
  if b.status not in ('pending', 'approved') then raise exception 'Booking tidak bisa dibatalkan.' using errcode = 'P0001'; end if;
  update public.fleet_bookings set status = 'cancelled' where id = p_booking;
end;
$$;

-- Simpan P2H: skor & hasil dihitung di sini (tidak dipercaya dari browser).
-- p_answers: [{ "item_id": uuid, "ok": bool }]
create or replace function public.fleet_submit_p2h(
  p_vehicle uuid,
  p_driver uuid,
  p_kind public.fleet_p2h_kind,
  p_booking uuid,
  p_odometer integer,
  p_answers jsonb,
  p_inspector text default null,
  p_notes text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.fleet_vehicles;
  v_score integer := 100;
  v_result public.fleet_p2h_result;
  v_critical boolean := false;
  v_issues text[] := '{}';
  v_answers jsonb := '[]'::jsonb;
  v_id uuid;
  v_code text;
  it record;
  v_ok boolean;
  v_missing integer;
begin
  if not public.has_module_role('fleet', array['admin', 'driver']) then
    raise exception 'Hanya admin atau driver yang bisa mengisi P2H.' using errcode = '42501';
  end if;
  if not public.fleet_is_admin() and p_driver is distinct from public.fleet_my_driver_id() then
    raise exception 'Driver hanya bisa mengisi P2H atas namanya sendiri.' using errcode = '42501';
  end if;
  select * into v from public.fleet_vehicles where id = p_vehicle for update;
  if not found or not public.can_see_company(v.company::text) then raise exception 'Kendaraan tidak ditemukan.' using errcode = 'P0001'; end if;
  if p_odometer < v.odometer - 50 then
    raise exception 'KM (%) lebih kecil dari KM terakhir kendaraan (%).', p_odometer, v.odometer using errcode = 'P0001';
  end if;
  if p_booking is not null and not exists (
    select 1 from public.fleet_bookings where id = p_booking and vehicle_id = p_vehicle and status in ('approved', 'in_use')
  ) then
    raise exception 'Booking tidak cocok dengan kendaraan / statusnya.' using errcode = 'P0001';
  end if;

  select count(*) into v_missing
  from public.fleet_p2h_items i
  where i.is_active and not exists (select 1 from jsonb_array_elements(p_answers) a where (a ->> 'item_id')::uuid = i.id);
  if v_missing > 0 then
    raise exception 'Masih ada % item checklist yang belum diisi.', v_missing using errcode = 'P0001';
  end if;

  for it in select * from public.fleet_p2h_items where is_active order by target desc, sort loop
    select (a ->> 'ok')::boolean into v_ok from jsonb_array_elements(p_answers) a where (a ->> 'item_id')::uuid = it.id limit 1;
    v_answers := v_answers || jsonb_build_object(
      'item_id', it.id, 'target', it.target, 'category', it.category, 'name', it.name,
      'weight', it.weight, 'critical', it.is_critical, 'ok', v_ok
    );
    if not v_ok then
      v_score := v_score - it.weight;
      v_critical := v_critical or it.is_critical;
      v_issues := v_issues || (case when it.target = 'driver' then 'Driver: ' else '' end || it.name);
    end if;
  end loop;
  v_score := greatest(0, v_score);
  v_result := case when v_critical or v_score < 70 then 'grounded' when v_score < 100 then 'caution' else 'fit' end;

  -- Peringatan dokumen & servis (tidak mengurangi skor)
  if v.tax_date is not null and v.tax_date - (now() at time zone 'Asia/Jakarta')::date <= 30 then
    v_issues := v_issues || ('Pajak/STNK jatuh tempo ' || to_char(v.tax_date, 'DD-MM-YYYY'));
  end if;
  if v.kir_date is not null and v.kir_date - (now() at time zone 'Asia/Jakarta')::date <= 30 then
    v_issues := v_issues || ('KIR jatuh tempo ' || to_char(v.kir_date, 'DD-MM-YYYY'));
  end if;
  if v.last_service_odo + v.service_interval_km - p_odometer <= 500 then
    v_issues := v_issues || ('Servis berkala sisa ' || (v.last_service_odo + v.service_interval_km - p_odometer) || ' km');
  end if;

  v_code := public.next_doc_code('P2H');
  insert into public.fleet_p2h_inspections (
    code, company, vehicle_id, driver_id, booking_id, kind, inspector_name, odometer, score, result,
    answers, issues, notes, lat, lng, next_due_date, created_by
  ) values (
    v_code, v.company, p_vehicle, p_driver, p_booking, p_kind, p_inspector, p_odometer, v_score, v_result,
    v_answers, v_issues, p_notes, p_lat, p_lng,
    case when p_kind = 'weekly' then (now() at time zone 'Asia/Jakarta')::date + 7 end,
    auth.uid()
  ) returning id into v_id;

  perform public.fleet_log_odometer(p_vehicle, p_odometer, 'p2h');

  -- Item kendaraan yang gagal -> antrean perbaikan (tanpa duplikat yang masih terbuka)
  insert into public.fleet_repairs (code, company, vehicle_id, inspection_id, component, is_critical, reported_by_name, reported_by)
  select public.next_doc_code('REP'), v.company, p_vehicle, v_id, a ->> 'name', (a ->> 'critical')::boolean,
         (select name from public.profiles where id = auth.uid()), auth.uid()
  from jsonb_array_elements(v_answers) a
  where a ->> 'target' = 'vehicle' and not (a ->> 'ok')::boolean
    and not exists (
      select 1 from public.fleet_repairs r
      where r.vehicle_id = p_vehicle and r.component = a ->> 'name' and r.status in ('queued', 'in_progress')
    );

  if v_result = 'grounded' and exists (
    select 1 from jsonb_array_elements(v_answers) a
    where a ->> 'target' = 'vehicle' and not (a ->> 'ok')::boolean and (a ->> 'critical')::boolean
  ) then
    update public.fleet_vehicles set status = 'grounded' where id = p_vehicle;
  end if;

  return v_id;
end;
$$;

-- Selesaikan perbaikan. Kendaraan GROUNDED kembali available bila tidak ada
-- perbaikan kritis yang masih terbuka.
create or replace function public.fleet_complete_repair(p_repair uuid, p_cost numeric, p_mechanic text, p_workshop text default null, p_part uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r public.fleet_repairs;
  v_odo integer;
begin
  if not public.fleet_is_admin() then
    raise exception 'Hanya admin Fleet yang bisa menyelesaikan perbaikan.' using errcode = '42501';
  end if;
  select * into r from public.fleet_repairs where id = p_repair for update;
  if not found then raise exception 'Perbaikan tidak ditemukan.' using errcode = 'P0001'; end if;
  if r.status in ('done', 'cancelled') then raise exception 'Perbaikan sudah ditutup.' using errcode = 'P0001'; end if;

  update public.fleet_repairs
  set status = 'done', actual_cost = p_cost, mechanic = p_mechanic, workshop = coalesce(p_workshop, workshop), done_at = now()
  where id = p_repair;

  select odometer into v_odo from public.fleet_vehicles where id = r.vehicle_id;
  insert into public.fleet_service_logs (vehicle_id, part_id, repair_id, odometer, cost, notes, created_by)
  values (r.vehicle_id, p_part, p_repair, v_odo, coalesce(p_cost, 0), r.component, auth.uid());

  if not exists (
    select 1 from public.fleet_repairs
    where vehicle_id = r.vehicle_id and status in ('queued', 'in_progress') and is_critical
  ) then
    update public.fleet_vehicles set status = 'available' where id = r.vehicle_id and status = 'grounded';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_odometer_logs enable row level security;
alter table public.fleet_drivers enable row level security;
alter table public.fleet_driver_vehicles enable row level security;
alter table public.fleet_inspectors enable row level security;
alter table public.fleet_parts enable row level security;
alter table public.fleet_service_logs enable row level security;
alter table public.fleet_bookings enable row level security;
alter table public.fleet_trip_points enable row level security;
alter table public.fleet_p2h_items enable row level security;
alter table public.fleet_p2h_inspections enable row level security;
alter table public.fleet_p2h_photos enable row level security;
alter table public.fleet_repairs enable row level security;
alter table public.fleet_fuel_logs enable row level security;

-- Data per company
create policy "fleet_vehicles_select" on public.fleet_vehicles for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_vehicles_write" on public.fleet_vehicles for all to authenticated
  using ((select public.fleet_is_admin()) and (select public.can_see_company(company::text)))
  with check ((select public.fleet_is_admin()) and (select public.can_see_company(company::text)));

create policy "fleet_odometer_select" on public.fleet_odometer_logs for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_odometer_admin" on public.fleet_odometer_logs for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

create policy "fleet_drivers_select" on public.fleet_drivers for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_drivers_write" on public.fleet_drivers for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

create policy "fleet_driver_vehicles_select" on public.fleet_driver_vehicles for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_driver_vehicles_write" on public.fleet_driver_vehicles for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

create policy "fleet_inspectors_select" on public.fleet_inspectors for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_inspectors_write" on public.fleet_inspectors for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

create policy "fleet_parts_select" on public.fleet_parts for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_parts_write" on public.fleet_parts for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

create policy "fleet_service_logs_select" on public.fleet_service_logs for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_service_logs_write" on public.fleet_service_logs for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

-- Booking: jadwal terlihat semua pengguna Fleet di company yang sama.
create policy "fleet_bookings_select" on public.fleet_bookings for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_bookings_insert" on public.fleet_bookings for insert to authenticated
  with check ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text))
    and requested_by = (select auth.uid()) and status = 'pending');
-- Update posisi GPS oleh driver; perubahan status lewat fungsi di atas.
create policy "fleet_bookings_update" on public.fleet_bookings for update to authenticated
  using ((select public.fleet_is_admin()) or driver_id = (select public.fleet_my_driver_id()))
  with check ((select public.can_see_company(company::text)));
create policy "fleet_bookings_delete" on public.fleet_bookings for delete to authenticated
  using ((select public.fleet_is_admin()));

create policy "fleet_trip_points_select" on public.fleet_trip_points for select to authenticated
  using ((select public.has_module_access('fleet')) and exists (
    select 1 from public.fleet_bookings b where b.id = booking_id
      and ((select public.fleet_is_admin()) or b.driver_id = (select public.fleet_my_driver_id()))
  ));
create policy "fleet_trip_points_insert" on public.fleet_trip_points for insert to authenticated
  with check (exists (
    select 1 from public.fleet_bookings b where b.id = booking_id and b.status = 'in_use'
      and (b.driver_id = (select public.fleet_my_driver_id()) or (select public.fleet_is_admin()))
  ));

create policy "fleet_p2h_items_select" on public.fleet_p2h_items for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_p2h_items_write" on public.fleet_p2h_items for all to authenticated
  using ((select public.fleet_is_admin())) with check ((select public.fleet_is_admin()));

-- P2H dibuat lewat fleet_submit_p2h (security invoker) -> policy insert
-- mengizinkan admin & driver; hapus hanya admin.
create policy "fleet_p2h_select" on public.fleet_p2h_inspections for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_p2h_insert" on public.fleet_p2h_inspections for insert to authenticated
  with check ((select public.has_module_role('fleet', array['admin', 'driver'])) and (select public.can_see_company(company::text)));
create policy "fleet_p2h_delete" on public.fleet_p2h_inspections for delete to authenticated
  using ((select public.fleet_is_admin()));

create policy "fleet_p2h_photos_select" on public.fleet_p2h_photos for select to authenticated
  using ((select public.has_module_access('fleet')));
create policy "fleet_p2h_photos_insert" on public.fleet_p2h_photos for insert to authenticated
  with check (exists (
    select 1 from public.fleet_p2h_inspections i where i.id = inspection_id
      and (i.created_by = (select auth.uid()) or (select public.fleet_is_admin()))
  ));

create policy "fleet_repairs_select" on public.fleet_repairs for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_repairs_insert" on public.fleet_repairs for insert to authenticated
  with check ((select public.has_module_role('fleet', array['admin', 'driver'])) and (select public.can_see_company(company::text)));
create policy "fleet_repairs_update" on public.fleet_repairs for update to authenticated
  using ((select public.fleet_is_admin()));
create policy "fleet_repairs_delete" on public.fleet_repairs for delete to authenticated
  using ((select public.fleet_is_admin()));

create policy "fleet_fuel_select" on public.fleet_fuel_logs for select to authenticated
  using ((select public.has_module_access('fleet')) and (select public.can_see_company(company::text)));
create policy "fleet_fuel_insert" on public.fleet_fuel_logs for insert to authenticated
  with check ((select public.can_see_company(company::text)) and (
    (select public.fleet_is_admin())
    or ((select public.has_module_role('fleet', array['driver'])) and driver_id = (select public.fleet_my_driver_id()))
  ));
create policy "fleet_fuel_admin" on public.fleet_fuel_logs for update to authenticated
  using ((select public.fleet_is_admin()));
create policy "fleet_fuel_delete" on public.fleet_fuel_logs for delete to authenticated
  using ((select public.fleet_is_admin()));

-- ---------------------------------------------------------------------
-- Storage: foto P2H & kendaraan. Path: {company}/{vehicle_id}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('p2h-photos', 'p2h-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('fleet-photos', 'fleet-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fleet_photos_select" on storage.objects for select to authenticated
  using (bucket_id in ('p2h-photos', 'fleet-photos')
    and (select public.has_module_access('fleet'))
    and (select public.can_see_company((storage.foldername(name))[1])));
create policy "fleet_photos_insert" on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'p2h-photos' and (select public.has_module_role('fleet', array['admin', 'driver']))
      or bucket_id = 'fleet-photos' and (select public.fleet_is_admin()))
    and (select public.can_see_company((storage.foldername(name))[1])));
create policy "fleet_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('p2h-photos', 'fleet-photos') and (select public.fleet_is_admin()));

-- ---------------------------------------------------------------------
-- Realtime untuk monitoring GPS
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.fleet_trip_points;
alter publication supabase_realtime add table public.fleet_bookings;

-- ---------------------------------------------------------------------
-- Data awal: checklist P2H gabungan (Fleet 25 item + GOA 36 item), part, SOP
-- ---------------------------------------------------------------------
insert into public.fleet_p2h_items (target, category, name, description, weight, is_critical, sort) values
('driver', 'Kesehatan', 'Fokus & bebas pengaruh alkohol/obat', 'Tidak mengantuk, bebas alkohol/obat yang memicu kantuk.', 15, true, 1),
('driver', 'Kesehatan', 'Kondisi fisik & refleks prima', 'Tidak sakit, refleks normal untuk mengemudi.', 15, true, 2),
('driver', 'Kesehatan', 'Tekanan darah normal', 'Tidak pusing / sakit kepala.', 10, false, 3),
('driver', 'Kesehatan', 'Cukup tidur', 'Tidur 6-8 jam sebelum bertugas.', 10, false, 4),
('driver', 'Kesehatan', 'Suhu tubuh normal', 'Di bawah 37,5°C.', 5, false, 5),
('driver', 'Kesehatan', 'Emosi stabil', 'Tidak dalam tekanan / stres berat.', 5, false, 6),
('driver', 'Kerapian', 'Rambut & wajah rapi', null, 2, false, 7),
('driver', 'Kerapian', 'Kuku bersih', null, 2, false, 8),
('driver', 'Kerapian', 'Seragam bersih', null, 2, false, 9),
('driver', 'Kerapian', 'Tidak bau badan', null, 2, false, 10),
('driver', 'Kerapian', 'Sepatu sesuai standar', null, 3, false, 11),
('vehicle', 'Mesin', 'Oli mesin (level & kebocoran)', 'Stik oli di antara min-max, tidak ada rembesan.', 3, true, 20),
('vehicle', 'Mesin', 'Air radiator & tutup radiator', 'Coolant cukup, tutup kencang.', 3, true, 21),
('vehicle', 'Mesin', 'Tali kipas (V-belt) & tensioner', 'Tidak kendor / retak.', 3, true, 22),
('vehicle', 'Mesin', 'Filter udara', 'Tidak tersumbat.', 2, false, 23),
('vehicle', 'Mesin', 'Aki & terminal', 'Terminal bersih & kencang.', 2, false, 24),
('vehicle', 'Kemudi', 'Gerakan kemudi', 'Berputar lancar tanpa bunyi aneh.', 3, true, 30),
('vehicle', 'Kemudi', 'Minyak power steering & rack', 'Level cukup, tidak bocor.', 3, true, 31),
('vehicle', 'Rem', 'Minyak rem & kopling', 'Di atas batas aman.', 3, true, 40),
('vehicle', 'Rem', 'Fungsi pedal & kampas rem', 'Pengereman pakem.', 3, true, 41),
('vehicle', 'Rem', 'Rem parkir (handbrake)', 'Menahan kendaraan.', 3, true, 42),
('vehicle', 'Roda', 'Tekanan & alur ban (4 roda)', 'Tekanan sesuai pabrikan, alur di atas TWI.', 3, true, 50),
('vehicle', 'Roda', 'Baut roda', 'Semua terpasang kencang.', 3, true, 51),
('vehicle', 'Roda', 'Ban cadangan', 'Tekanan & kondisi layak.', 2, false, 52),
('vehicle', 'Listrik', 'Lampu utama jauh/dekat', null, 2, false, 60),
('vehicle', 'Listrik', 'Lampu sein & hazard', null, 2, false, 61),
('vehicle', 'Listrik', 'Lampu rem belakang', null, 2, false, 62),
('vehicle', 'Listrik', 'Lampu mundur & sirine', null, 2, false, 63),
('vehicle', 'Listrik', 'Klakson', null, 2, false, 64),
('vehicle', 'Listrik', 'Wiper & air wiper', null, 2, false, 65),
('vehicle', 'Kabin & Safety', 'Sabuk pengaman', 'Mengunci saat ditarik cepat.', 3, false, 70),
('vehicle', 'Kabin & Safety', 'Kaca depan & spion', 'Bersih, tidak retak.', 2, false, 71),
('vehicle', 'Kabin & Safety', 'APAR', 'Tersedia, jarum indikator hijau.', 2, false, 72),
('vehicle', 'Kabin & Safety', 'Segitiga pengaman', null, 2, false, 73),
('vehicle', 'Kabin & Safety', 'Dongkrak & kunci roda', null, 2, false, 74),
('vehicle', 'Kabin & Safety', 'Kotak P3K lengkap', null, 2, false, 75),
('vehicle', 'Body', 'Bumper & body (penyok / baret)', null, 1, false, 80),
('vehicle', 'Body', 'Pintu & engsel', 'Menutup rapat.', 1, false, 81),
('vehicle', 'Kebersihan', 'Kabin dalam bersih', null, 1, false, 90),
('vehicle', 'Kebersihan', 'Body luar bersih', null, 1, false, 91),
('vehicle', 'Kebersihan', 'Kaca bersih', null, 1, false, 92),
('vehicle', 'Kebersihan', 'Kargo / bak bersih', null, 1, false, 93);

insert into public.fleet_parts (name, type, interval, cost) values
  ('Oli Mesin', 'km', 10000, 450000),
  ('Kampas Rem', 'km', 20000, 650000),
  ('Ban Luar', 'km', 40000, 1200000);
insert into public.fleet_parts (name, type, interval, cost, date_source) values
  ('Pajak Tahunan', 'days', 365, 0, 'tax_date'),
  ('KIR', 'days', 180, 0, 'kir_date');

insert into public.sop_pages (module, slug, title, sort, content_md) values
('fleet', 'booking', 'SOP-01: Booking Kendaraan', 1,
'1. Pemohon mengajukan booking minimal **1 hari** sebelum berangkat (kecuali darurat).
2. Isi tujuan, waktu mulai & selesai. Sistem menolak jadwal yang bentrok.
3. Admin GA menyetujui dan menunjuk driver.
4. Driver **wajib mengisi P2H** sebelum menekan *Mulai perjalanan*.
5. Selama perjalanan, halaman trip harus tetap terbuka supaya GPS terkirim.
6. Setelah kembali, driver mengisi KM akhir dan menekan *Selesai*.'),
('fleet', 'p2h', 'SOP-02: P2H (Pemeriksaan Harian)', 2,
'1. P2H diisi **sebelum setiap perjalanan** (pre-trip) dan **mingguan** untuk kendaraan operasional.
2. Periksa kesehatan driver, kerapian, lalu seluruh item kendaraan.
3. Foto 4 sisi kendaraan wajib dilampirkan.
4. Hasil:
   - **Layak (FIT)**: semua item baik.
   - **Layak dengan catatan (CAUTION)**: ada item minor yang gagal.
   - **Tidak layak (GROUNDED)**: ada item kritis gagal atau skor < 70. Kendaraan tidak boleh berangkat.
5. Item kendaraan yang gagal otomatis masuk **Daftar Perbaikan**.'),
('fleet', 'bbm', 'SOP-03: Pengisian BBM', 3,
'1. Setiap pengisian BBM dicatat: KM awal, KM akhir, liter, dan total biaya.
2. Rasio dihitung otomatis (km/liter):
   - ≥ 15: **Sangat irit**
   - 10–15: **Irit**
   - 7–10: **Cukup**
   - < 7: **Boros**, perlu dicek.')
on conflict do nothing;
