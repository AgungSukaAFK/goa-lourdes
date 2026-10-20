-- =====================================================================
-- GOA: lampiran tugas (seperti GOA lama)
-- - before : foto/dokumen kondisi awal dari atasan / pembuat tugas
-- - after  : bukti selesai dari PIC (wajib saat tugas ditutup Selesai)
-- - review : lampiran reviewer/atasan saat menilai tugas yang sudah ditutup
-- File di bucket private `goa-files`, path: {task_id}/{file}
-- =====================================================================

create type public.goa_file_kind as enum ('before', 'after', 'review');

create table public.goa_task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.goa_tasks (id) on delete cascade,
  kind public.goa_file_kind not null,
  path text not null unique,
  name text not null,
  mime text not null,
  size integer not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index goa_task_files_task_idx on public.goa_task_files (task_id, kind);

alter table public.goa_task_files enable row level security;

-- Baca mengikuti akses tugasnya; tulis hanya lewat fungsi di bawah.
create policy "goa_task_files_select" on public.goa_task_files for select to authenticated
  using (exists (select 1 from public.goa_tasks t where t.id = goa_task_files.task_id)
    and (select public.has_module_access('goa')));

-- Jumlah lampiran di view tugas (kolom baru di akhir supaya view lama tetap kompatibel)
create or replace view public.goa_tasks_view
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

-- ---------------------------------------------------------------------
-- Fungsi
-- ---------------------------------------------------------------------

-- p_files: [{"path": "...", "name": "...", "mime": "...", "size": 123}]
create or replace function public.goa_add_task_files(p_task uuid, p_kind public.goa_file_kind, p_files jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.goa_tasks := public.goa_task_for_update(p_task);
  f jsonb;
  n integer := 0;
  is_open boolean := t.status in ('pending', 'in_progress');
begin
  if coalesce(jsonb_typeof(p_files), '') <> 'array' or jsonb_array_length(p_files) = 0 then
    raise exception 'Pilih file yang akan dilampirkan.' using errcode = 'P0001';
  end if;

  if p_kind = 'before' then
    if not (public.goa_is_supervisor() or t.created_by = auth.uid()) then
      raise exception 'Foto before hanya dari atasan / pembuat tugas.' using errcode = '42501';
    end if;
    if not is_open then raise exception 'Tugas % sudah ditutup.', t.code using errcode = 'P0001'; end if;
  elsif p_kind = 'after' then
    if not (public.goa_is_supervisor() or coalesce(t.assignee_id, auth.uid()) = auth.uid()) then
      raise exception 'Bukti selesai hanya dari PIC atau atasan.' using errcode = '42501';
    end if;
    if not (is_open or t.status = 'done') then
      raise exception 'Tugas % ditutup tidak selesai, bukti tidak bisa ditambah.', t.code using errcode = 'P0001';
    end if;
    if not public.has_module_role('goa', array['supervisor', 'member']) then
      raise exception 'Guest tidak bisa mengerjakan tugas.' using errcode = '42501';
    end if;
  else
    if not (public.goa_is_supervisor() or t.reviewer_id = auth.uid()) then
      raise exception 'Hanya atasan / reviewer yang bisa melampirkan file review.' using errcode = '42501';
    end if;
    if t.assignee_id = auth.uid() then
      raise exception 'Tugas sendiri tidak bisa direview sendiri (%).', t.code using errcode = '42501';
    end if;
    if is_open then raise exception 'Tugas % belum ditutup.', t.code using errcode = 'P0001'; end if;
  end if;

  if (select count(*) from public.goa_task_files where task_id = p_task and kind = p_kind) + jsonb_array_length(p_files) > 10 then
    raise exception 'Maksimal 10 lampiran per jenis.' using errcode = 'P0001';
  end if;

  for f in select * from jsonb_array_elements(p_files) loop
    -- File harus sudah ada di folder tugas ini dan diupload oleh user ini.
    if split_part(f->>'path', '/', 1) <> p_task::text or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'goa-files' and o.name = f->>'path' and o.owner_id = auth.uid()::text
    ) then
      raise exception 'File lampiran tidak valid.' using errcode = 'P0001';
    end if;
    insert into public.goa_task_files (task_id, kind, path, name, mime, size, uploaded_by)
    values (
      p_task, p_kind, f->>'path',
      left(coalesce(nullif(trim(f->>'name'), ''), 'lampiran'), 200),
      coalesce(f->>'mime', 'application/octet-stream'),
      coalesce((f->>'size')::integer, 0),
      auth.uid()
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.goa_add_task_files(uuid, public.goa_file_kind, jsonb) from public, anon;
grant execute on function public.goa_add_task_files(uuid, public.goa_file_kind, jsonb) to authenticated;

-- Hapus lampiran; mengembalikan path supaya file storage ikut dihapus.
create or replace function public.goa_delete_task_file(p_file uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.goa_task_files;
  t public.goa_tasks;
begin
  select * into f from public.goa_task_files where id = p_file;
  if not found then raise exception 'Lampiran tidak ditemukan.' using errcode = 'P0001'; end if;
  t := public.goa_task_for_update(f.task_id);
  if not public.goa_is_supervisor() then
    if f.uploaded_by is distinct from auth.uid() then
      raise exception 'Hanya pengunggah atau atasan yang bisa menghapus lampiran.' using errcode = '42501';
    end if;
    -- Bukti tugas yang sudah ditutup dikunci supaya tidak hilang setelah dinilai.
    if f.kind = 'after' and t.status not in ('pending', 'in_progress') then
      raise exception 'Bukti tugas yang sudah ditutup hanya bisa dihapus atasan.' using errcode = '42501';
    end if;
  end if;
  delete from public.goa_task_files where id = p_file;
  return f.path;
end;
$$;
revoke all on function public.goa_delete_task_file(uuid) from public, anon;
grant execute on function public.goa_delete_task_file(uuid) to authenticated;

-- Selesai wajib ada bukti (kecuali task P2H, buktinya laporan P2H itu sendiri).
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
  if p_done and t.source <> 'p2h' and not exists (
    select 1 from public.goa_task_files where task_id = p_task and kind = 'after'
  ) then
    raise exception 'Lampirkan bukti selesai (foto/dokumen) untuk tugas %.', t.code using errcode = 'P0001';
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

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('goa-files', 'goa-files', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do nothing;

-- Baca: file yang sudah tercatat di tugas yang terlihat, atau file upload sendiri.
create policy "goa_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'goa-files' and (
    owner_id = (select auth.uid())::text
    -- kolom `name` harus dikualifikasi: goa_task_files juga punya kolom name
    or exists (select 1 from public.goa_task_files f where f.path = storage.objects.name)
  ));
-- Upload: ke folder tugas yang terlihat oleh user.
create policy "goa_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'goa-files'
    and (select public.has_module_access('goa'))
    and exists (select 1 from public.goa_tasks t where t.id::text = (storage.foldername(storage.objects.name))[1]));
create policy "goa_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'goa-files' and (owner_id = (select auth.uid())::text or (select public.goa_is_supervisor())));

-- ---------------------------------------------------------------------
-- SOP
-- ---------------------------------------------------------------------
update public.sop_pages
set content_md = replace(content_md,
  '3. PIC menekan **Mulai** saat mengerjakan, lalu **Selesai** dengan catatan, atau **Tidak selesai** dengan alasan.',
  '3. PIC menekan **Mulai** saat mengerjakan, lalu **Selesai** dengan catatan dan **bukti selesai** (foto/dokumen, wajib), atau **Tidak selesai** dengan alasan. Atasan/pembuat tugas bisa melampirkan **foto before** saat membuat tugas.')
where module = 'goa' and slug = 'alur-tugas';

update public.sop_pages
set content_md = content_md || '
7. Reviewer bisa melampirkan file (foto temuan, catatan, dokumen) saat menilai lewat tombol **Lampiran** di kartu atau tabel tugas.'
where module = 'goa' and slug = 'alur-tugas' and content_md not like '%tombol **Lampiran**%';
