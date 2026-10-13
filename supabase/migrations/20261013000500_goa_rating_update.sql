-- =====================================================================
-- GOA: penyesuaian dengan GOA 5.5 terbaru
-- - Rating boleh untuk semua tugas yang sudah ditutup (selesai, tidak selesai, hangus)
-- - Rating massal (atomik: semua tersimpan atau tidak sama sekali)
-- - Bobot KPI default: 60% penyelesaian + 40% rating
-- =====================================================================

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
  if t.assignee_id = auth.uid() then
    raise exception 'Tugas sendiri tidak bisa dinilai sendiri (%).', t.code using errcode = '42501';
  end if;
  if t.status not in ('done', 'undone', 'expired') then
    raise exception 'Tugas % belum ditutup, belum bisa dinilai.', t.code using errcode = 'P0001';
  end if;
  if p_rating not between 1 and 5 then raise exception 'Nilai 1-5.' using errcode = 'P0001'; end if;
  update public.goa_tasks set rating = p_rating, rated_by = auth.uid(), rated_at = now() where id = p_task;
end;
$$;

create or replace function public.goa_rate_tasks(p_tasks uuid[], p_rating integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  id uuid;
  n integer := 0;
begin
  if coalesce(array_length(p_tasks, 1), 0) = 0 then raise exception 'Pilih tugas yang akan dinilai.' using errcode = 'P0001'; end if;
  if array_length(p_tasks, 1) > 500 then raise exception 'Maksimal 500 tugas sekali nilai.' using errcode = 'P0001'; end if;
  foreach id in array p_tasks loop
    perform public.goa_rate_task(id, p_rating);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.goa_rate_tasks(uuid[], integer) from public, anon;
grant execute on function public.goa_rate_tasks(uuid[], integer) to authenticated;

-- Bobot global hanya diganti kalau masih bawaan awal (belum diubah atasan).
update public.goa_kpi_settings
set parameters = '[
  {"key": "done_ratio", "label": "Penyelesaian tugas", "weight": 3},
  {"key": "quality", "label": "Rating reviewer", "weight": 2}
]', updated_at = now()
where target = 'GLOBAL' and parameters = '[
  {"key": "speed", "label": "Ketepatan waktu", "weight": 1},
  {"key": "quality", "label": "Kualitas (rating)", "weight": 2},
  {"key": "done_ratio", "label": "Rasio selesai", "weight": 1},
  {"key": "active_ratio", "label": "Keaktifan", "weight": 1}
]'::jsonb;

update public.sop_pages
set content_md = replace(content_md,
  '5. Atasan memberi nilai 1–5 untuk tugas selesai. Nilai ini masuk ke KPI kualitas.',
  '5. Reviewer/atasan memberi nilai 1–5 untuk tugas yang sudah ditutup (selesai, tidak selesai, atau hangus), satu per satu atau sekaligus dari **Tabel Tugas**.
6. KPI = 60% penyelesaian (selesai ÷ tugas yang ditutup) + 40% rating, dikurangi penalti SP. Selama belum ada rating, KPI memakai penyelesaian saja.')
where module = 'goa' and slug = 'alur-tugas';
