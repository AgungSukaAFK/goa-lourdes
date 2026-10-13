-- Ringkasan dashboard Asset (security invoker: hanya menghitung baris yang boleh dilihat).
create or replace function public.asset_dashboard(p_company public.company_code default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with a as (
    select v.* from public.assets_view v where p_company is null or v.company = p_company
  )
  select jsonb_build_object(
    'total', (select count(*) from a where status <> 'disposed'),
    'cost', (select coalesce(sum(cost), 0) from a where status <> 'disposed'),
    'book_value', (select coalesce(sum(book_value), 0) from a where status <> 'disposed'),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from a group by status) x),
    'by_company', (select coalesce(jsonb_object_agg(company, jsonb_build_object('count', n, 'value', val)), '{}')
                   from (select company, count(*) n, sum(book_value) val from a where status <> 'disposed' group by company) x),
    'by_site', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(site_name, 'Tanpa site'), 'count', n, 'value', val) order by n desc), '[]')
                from (select site_name, count(*) n, sum(book_value) val from a where status <> 'disposed' group by site_name order by n desc limit 10) x),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(category_name, 'Tanpa kategori'), 'count', n) order by n desc), '[]')
                    from (select category_name, count(*) n from a where status <> 'disposed' group by category_name order by n desc limit 8) x),
    'loans_pending', (select count(*) from public.asset_loans l where l.status = 'pending' and (p_company is null or l.company = p_company)),
    'loans_active', (select count(*) from public.asset_loans l where l.status = 'approved' and (p_company is null or l.company = p_company)),
    'loans_overdue', (select count(*) from public.asset_loans l where l.status = 'approved'
                        and l.expected_return_date < (now() at time zone 'Asia/Jakarta')::date and (p_company is null or l.company = p_company)),
    'mutations_pending', (select count(*) from public.asset_mutations m where m.status = 'pending' and (p_company is null or m.company = p_company)),
    'audits_waiting', (select count(*) from public.asset_audits au where au.status = 'waiting' and (p_company is null or au.company = p_company)),
    'audits_overdue', (select count(*) from public.asset_audits au where au.status = 'waiting'
                        and au.due_date < (now() at time zone 'Asia/Jakarta')::date and (p_company is null or au.company = p_company))
  );
$$;
