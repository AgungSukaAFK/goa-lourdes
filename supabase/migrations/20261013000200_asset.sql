-- =====================================================================
-- GOA HZ — Modul Asset: kategori, aset, peminjaman, mutasi, audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Penomoran dokumen generik (kode aset, no. pinjam, no. mutasi, dst.)
-- ---------------------------------------------------------------------
create table public.doc_counters (
  key text primary key,
  value integer not null default 0
);
alter table public.doc_counters enable row level security;
-- Tidak ada policy: hanya diakses lewat next_counter() (security definer).

create or replace function public.next_counter(p_key text)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.doc_counters as c (key, value) values (p_key, 1)
  on conflict (key) do update set value = c.value + 1
  returning value;
$$;
revoke all on function public.next_counter(text) from public, anon;
grant execute on function public.next_counter(text) to authenticated;

-- "LN-202610-0007"
create or replace function public.next_doc_code(p_prefix text)
returns text
language sql
security definer
set search_path = ''
as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM') || '-' ||
    lpad(public.next_counter(p_prefix || ':' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM'))::text, 4, '0');
$$;
revoke all on function public.next_doc_code(text) from public, anon;
grant execute on function public.next_doc_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------
create type public.asset_status as enum ('ready', 'loaned', 'damaged', 'lost', 'disposed');
create type public.asset_request_status as enum ('pending', 'approved', 'rejected', 'returned');
create type public.asset_audit_status as enum ('waiting', 'fulfilled');

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- singkatan untuk {CAT} di format kode (default 3 huruf pertama nama)
  code text,
  depreciation_years integer not null default 4 check (depreciation_years between 0 and 50),
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  accurate_code text,
  name text not null,
  category_id uuid references public.asset_categories (id) on delete set null,
  brand text,
  model text,
  serial_number text,
  status public.asset_status not null default 'ready',
  cost numeric(16, 2) not null default 0 check (cost >= 0),
  purchase_date date,
  depreciation_years integer not null default 4 check (depreciation_years between 0 and 50),
  site_id uuid references public.sites (id) on delete set null,
  owner_employee_id uuid references public.employees (id) on delete set null,
  is_borrowable boolean not null default false,
  mr_number text,
  po_number text,
  company public.company_code not null,
  photo_path text,
  notes text,
  legacy_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_company_idx on public.assets (company);
create index assets_status_idx on public.assets (status);
create index assets_site_idx on public.assets (site_id);
create index assets_owner_idx on public.assets (owner_employee_id);
create index assets_category_idx on public.assets (category_id);

create table public.asset_loans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  asset_id uuid not null references public.assets (id) on delete cascade,
  borrower_employee_id uuid not null references public.employees (id),
  company public.company_code not null,
  borrow_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  expected_return_date date not null,
  actual_return_date date,
  purpose text,
  status public.asset_request_status not null default 'pending',
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  returned_by uuid references public.profiles (id) on delete set null,
  return_condition public.asset_status,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_return_date >= borrow_date)
);
create index asset_loans_asset_idx on public.asset_loans (asset_id);
create index asset_loans_status_idx on public.asset_loans (status);
-- Satu aset hanya boleh punya satu pinjaman berjalan.
create unique index asset_loans_one_active on public.asset_loans (asset_id) where status in ('pending', 'approved');

create table public.asset_mutations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  asset_id uuid not null references public.assets (id) on delete cascade,
  company public.company_code not null,
  from_employee_id uuid references public.employees (id) on delete set null,
  to_employee_id uuid references public.employees (id) on delete set null,
  from_site_id uuid references public.sites (id) on delete set null,
  to_site_id uuid references public.sites (id) on delete set null,
  reason text,
  status public.asset_request_status not null default 'pending',
  is_direct boolean not null default false,
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index asset_mutations_asset_idx on public.asset_mutations (asset_id);
create unique index asset_mutations_one_pending on public.asset_mutations (asset_id) where status = 'pending';

create table public.asset_audits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  asset_id uuid not null references public.assets (id) on delete cascade,
  company public.company_code not null,
  due_date date not null,
  status public.asset_audit_status not null default 'waiting',
  found_condition public.asset_status,
  notes text,
  photo_path text,
  realized_by uuid references public.profiles (id) on delete set null,
  realized_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index asset_audits_asset_idx on public.asset_audits (asset_id);
create index asset_audits_status_idx on public.asset_audits (status, due_date);

create trigger set_updated_at before update on public.asset_categories for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.asset_loans for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.asset_mutations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.asset_audits for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Nilai buku (penyusutan garis lurus, dihitung saat dibaca)
-- ---------------------------------------------------------------------
create or replace function public.asset_book_value(cost numeric, purchase_date date, years integer)
returns numeric
language sql
stable
as $$
  select case
    when cost is null or cost <= 0 then 0
    when purchase_date is null or years is null or years <= 0 then cost
    else round(greatest(0, cost - cost / years * greatest(0, (current_date - purchase_date)::numeric / 365.25)), 0)
  end;
$$;

create view public.assets_view
with (security_invoker = true)
as
select
  a.*,
  public.asset_book_value(a.cost, a.purchase_date, a.depreciation_years) as book_value,
  c.name as category_name,
  s.name as site_name,
  e.name as owner_name,
  e.nrp as owner_nrp
from public.assets a
left join public.asset_categories c on c.id = a.category_id
left join public.sites s on s.id = a.site_id
left join public.employees e on e.id = a.owner_employee_id;

-- ---------------------------------------------------------------------
-- Log aktivitas otomatis
-- ---------------------------------------------------------------------
create or replace function public.asset_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_action text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
  elsif v_row ? 'status' and (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status') then
    v_action := 'status:' || (to_jsonb(new) ->> 'status');
  else
    v_action := 'update';
  end if;

  v_summary := coalesce(v_row ->> 'code', '') ||
    case when v_row ? 'name' then ' ' || (v_row ->> 'name') else '' end;

  insert into public.activity_logs (module, company, entity, entity_id, action, summary, actor_id, data)
  values (
    'asset',
    (v_row ->> 'company')::public.profile_company,
    v_entity,
    v_row ->> 'id',
    v_action,
    nullif(trim(v_summary), ''),
    auth.uid(),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else v_row end
  );
  return coalesce(new, old);
end;
$$;

create trigger log_changes after insert or update or delete on public.assets for each row execute function public.asset_log('asset');
create trigger log_changes after insert or update or delete on public.asset_loans for each row execute function public.asset_log('loan');
create trigger log_changes after insert or update or delete on public.asset_mutations for each row execute function public.asset_log('mutation');
create trigger log_changes after insert or update or delete on public.asset_audits for each row execute function public.asset_log('audit');

-- ---------------------------------------------------------------------
-- Alur kerja (atomik). Fungsi security invoker: RLS tetap berlaku,
-- ditambah cek role admin Asset untuk keputusan GA.
-- ---------------------------------------------------------------------
create or replace function public.asset_require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.has_module_role('asset', array['admin']) then
    raise exception 'Hanya admin Asset yang boleh melakukan aksi ini.' using errcode = '42501';
  end if;
end;
$$;

-- Setujui / tolak peminjaman
create or replace function public.asset_decide_loan(p_loan uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_loan public.asset_loans;
begin
  perform public.asset_require_admin();
  select * into v_loan from public.asset_loans where id = p_loan for update;
  if not found then raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_loan.status <> 'pending' then raise exception 'Peminjaman sudah diproses.' using errcode = 'P0001'; end if;

  if p_approve then
    if exists (select 1 from public.assets where id = v_loan.asset_id and status <> 'ready') then
      raise exception 'Aset sedang tidak tersedia (bukan READY).' using errcode = 'P0001';
    end if;
    update public.assets set status = 'loaned' where id = v_loan.asset_id;
  end if;

  update public.asset_loans
  set status = case when p_approve then 'approved'::public.asset_request_status else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = p_note
  where id = p_loan;
end;
$$;

-- Pengembalian pinjaman
create or replace function public.asset_return_loan(p_loan uuid, p_condition public.asset_status default 'ready', p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_loan public.asset_loans;
begin
  perform public.asset_require_admin();
  select * into v_loan from public.asset_loans where id = p_loan for update;
  if not found then raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_loan.status <> 'approved' then raise exception 'Hanya pinjaman berjalan yang bisa dikembalikan.' using errcode = 'P0001'; end if;
  if p_condition not in ('ready', 'damaged', 'lost') then
    raise exception 'Kondisi kembali tidak valid.' using errcode = 'P0001';
  end if;

  update public.asset_loans
  set status = 'returned', actual_return_date = (now() at time zone 'Asia/Jakarta')::date,
      returned_by = auth.uid(), return_condition = p_condition,
      decision_note = coalesce(p_note, decision_note)
  where id = p_loan;
  update public.assets set status = p_condition where id = v_loan.asset_id;
end;
$$;

-- Setujui / tolak mutasi
create or replace function public.asset_decide_mutation(p_mutation uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_mut public.asset_mutations;
begin
  perform public.asset_require_admin();
  select * into v_mut from public.asset_mutations where id = p_mutation for update;
  if not found then raise exception 'Mutasi tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_mut.status <> 'pending' then raise exception 'Mutasi sudah diproses.' using errcode = 'P0001'; end if;

  if p_approve then
    if exists (select 1 from public.assets where id = v_mut.asset_id and status = 'loaned') then
      raise exception 'Aset sedang dipinjam. Selesaikan peminjaman dulu.' using errcode = 'P0001';
    end if;
    update public.assets
    set owner_employee_id = v_mut.to_employee_id,
        site_id = coalesce(v_mut.to_site_id, site_id)
    where id = v_mut.asset_id;
  end if;

  update public.asset_mutations
  set status = case when p_approve then 'approved'::public.asset_request_status else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = p_note
  where id = p_mutation;
end;
$$;

-- Realisasi audit: catat kondisi temuan & update status aset
create or replace function public.asset_realize_audit(
  p_audit uuid, p_condition public.asset_status, p_notes text, p_photo text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_audit public.asset_audits;
begin
  if not public.asset_can('audits', 'write') then
    raise exception 'Anda tidak punya akses realisasi audit.' using errcode = '42501';
  end if;
  select * into v_audit from public.asset_audits where id = p_audit for update;
  if not found then raise exception 'Audit tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_audit.status <> 'waiting' then raise exception 'Audit sudah direalisasi.' using errcode = 'P0001'; end if;

  update public.asset_audits
  set status = 'fulfilled', found_condition = p_condition, notes = p_notes,
      photo_path = coalesce(p_photo, photo_path), realized_by = auth.uid(), realized_at = now()
  where id = p_audit;

  -- Aset yang sedang dipinjam tetap "loaned" kecuali ditemukan rusak/hilang.
  update public.assets
  set status = p_condition
  where id = v_audit.asset_id
    and (status <> 'loaned' or p_condition in ('damaged', 'lost'));
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;
alter table public.asset_loans enable row level security;
alter table public.asset_mutations enable row level security;
alter table public.asset_audits enable row level security;

create policy "asset_categories_select" on public.asset_categories for select to authenticated
  using ((select public.has_module_access('asset')));
create policy "asset_categories_write" on public.asset_categories for all to authenticated
  using ((select public.asset_can('config', 'write')))
  with check ((select public.asset_can('config', 'write')));

create policy "assets_select" on public.assets for select to authenticated
  using ((select public.has_module_access('asset')) and (select public.can_see_company(company::text)));
create policy "assets_insert" on public.assets for insert to authenticated
  with check ((select public.asset_can('assets', 'write')) and (select public.can_see_company(company::text)));
create policy "assets_update" on public.assets for update to authenticated
  using ((select public.can_see_company(company::text)) and (
    (select public.asset_can('assets', 'write'))
    or (select public.asset_can('audits', 'write'))
    or (select public.has_module_role('asset', array['admin']))
  ))
  with check ((select public.can_see_company(company::text)));
create policy "assets_delete" on public.assets for delete to authenticated
  using ((select public.asset_can('assets', 'delete')) and (select public.can_see_company(company::text)));

create policy "asset_loans_select" on public.asset_loans for select to authenticated
  using ((select public.has_module_access('asset')) and (select public.can_see_company(company::text)));
create policy "asset_loans_insert" on public.asset_loans for insert to authenticated
  with check ((select public.asset_can('loans', 'write')) and (select public.can_see_company(company::text)) and status = 'pending');
create policy "asset_loans_update" on public.asset_loans for update to authenticated
  using ((select public.has_module_role('asset', array['admin'])) and (select public.can_see_company(company::text)));
create policy "asset_loans_delete" on public.asset_loans for delete to authenticated
  using ((select public.asset_can('loans', 'delete')) and (select public.can_see_company(company::text)) and status in ('pending', 'rejected'));

create policy "asset_mutations_select" on public.asset_mutations for select to authenticated
  using ((select public.has_module_access('asset')) and (select public.can_see_company(company::text)));
create policy "asset_mutations_insert" on public.asset_mutations for insert to authenticated
  with check ((select public.asset_can('mutations', 'write')) and (select public.can_see_company(company::text))
    and (status = 'pending' or (select public.has_module_role('asset', array['admin']))));
create policy "asset_mutations_update" on public.asset_mutations for update to authenticated
  using ((select public.has_module_role('asset', array['admin'])) and (select public.can_see_company(company::text)));
create policy "asset_mutations_delete" on public.asset_mutations for delete to authenticated
  using ((select public.asset_can('mutations', 'delete')) and (select public.can_see_company(company::text)) and status in ('pending', 'rejected'));

create policy "asset_audits_select" on public.asset_audits for select to authenticated
  using ((select public.has_module_access('asset')) and (select public.can_see_company(company::text)));
create policy "asset_audits_insert" on public.asset_audits for insert to authenticated
  with check ((select public.asset_can('audits', 'write')) and (select public.can_see_company(company::text)));
create policy "asset_audits_update" on public.asset_audits for update to authenticated
  using ((select public.asset_can('audits', 'write')) and (select public.can_see_company(company::text)));
create policy "asset_audits_delete" on public.asset_audits for delete to authenticated
  using ((select public.asset_can('audits', 'delete')) and (select public.can_see_company(company::text)));

-- ---------------------------------------------------------------------
-- Storage: foto aset & foto audit. Path: {company}/{asset_id}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('asset-photos', 'asset-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('audit-photos', 'audit-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "asset_photos_select" on storage.objects for select to authenticated
  using (bucket_id in ('asset-photos', 'audit-photos')
    and (select public.has_module_access('asset'))
    and (select public.can_see_company((storage.foldername(name))[1])));
create policy "asset_photos_insert" on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'asset-photos' and (select public.asset_can('assets', 'write'))
      or bucket_id = 'audit-photos' and (select public.asset_can('audits', 'write')))
    and (select public.can_see_company((storage.foldername(name))[1])));
create policy "asset_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('asset-photos', 'audit-photos')
    and (select public.asset_can('assets', 'write'))
    and (select public.can_see_company((storage.foldername(name))[1])));

-- ---------------------------------------------------------------------
-- Data awal
-- ---------------------------------------------------------------------
insert into public.app_settings (key, company, value) values
  ('asset_code_format', 'GMI', '"GMI-{SITE}-{CAT}-{DATE}-{DEP}-{NAME}-{NUM}"'),
  ('asset_code_format', 'GIS', '"GIS-{SITE}-{CAT}-{DATE}-{DEP}-{NAME}-{NUM}"')
on conflict do nothing;

insert into public.sop_pages (module, slug, title, sort, content_md) values
('asset', 'pengadaan', 'SOP-01: Pengadaan & Registrasi', 1,
'1. Pengajuan pengadaan wajib melampirkan **MR (Material Request)**.
2. GA menguji kelayakan spesifikasi dan menerbitkan **PO** resmi perusahaan.
3. Unit fisik yang diterima wajib diregistrasi ke GOA HZ paling lambat **1×24 jam**.
4. Kode aset dibuat otomatis sesuai format per PT (atur di Admin → Pengaturan).'),
('asset', 'mutasi', 'SOP-02: Mutasi & Serah Terima', 2,
'1. Aset **dilarang** dipindahtangankan tanpa pengajuan mutasi di sistem.
2. Mutasi wajib menyertakan karyawan penerima yang aktif dan alasan perpindahan.
3. Penerima wajib memeriksa fisik aset sebelum GA menyetujui.
4. Pemegang & lokasi aset berubah otomatis setelah mutasi disetujui GA.'),
('asset', 'peminjaman', 'SOP-03: Peminjaman', 3,
'1. Hanya aset dengan tanda **Dapat dipinjam** yang bisa dipinjam lintas karyawan.
2. Peminjam mengisi tanggal kembali dan tujuan penggunaan.
3. Status aset otomatis menjadi **Dipinjam** setelah disetujui GA.
4. Pinjaman yang melewati batas kembali ditandai **Terlambat** di daftar peminjaman.'),
('asset', 'status', 'SOP-04: Audit & Status Kondisi', 4,
'| Status | Arti |
|---|---|
| **Ready** | Kondisi baik, siap dipakai atau dialokasikan. |
| **Dipinjam** | Sedang dipakai sementara dengan dokumen pinjam yang sah. |
| **Rusak** | Malfungsi fisik. Wajib diaudit atau diproses disposal. |
| **Hilang** | Tidak ditemukan saat audit. |
| **Disposal** | Sudah dihapus dari penggunaan. |

Audit dilakukan dengan memeriksa fisik aset, mengisi kondisi temuan, dan melampirkan foto.')
on conflict do nothing;
