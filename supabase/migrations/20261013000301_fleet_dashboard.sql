-- Ringkasan dashboard Fleet (security invoker).
create or replace function public.fleet_dashboard(p_company public.company_code default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (select * from public.fleet_vehicles where p_company is null or company = p_company),
  today as (select (now() at time zone 'Asia/Jakarta')::date as d),
  p30 as (
    select i.* from public.fleet_p2h_inspections i
    where i.created_at > now() - interval '30 days' and (p_company is null or i.company = p_company)
  ),
  open_rep as (
    select r.* from public.fleet_repairs r
    where r.status in ('queued', 'in_progress') and (p_company is null or r.company = p_company)
  )
  select jsonb_build_object(
    'vehicles', (select count(*) from v where status <> 'inactive'),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from v group by status) x),
    'bookings_pending', (select count(*) from public.fleet_bookings b where b.status = 'pending' and (p_company is null or b.company = p_company)),
    'trips_active', (select count(*) from public.fleet_bookings b where b.status = 'in_use' and (p_company is null or b.company = p_company)),
    'bookings_today', (select count(*) from public.fleet_bookings b, today
                        where b.status in ('approved', 'in_use', 'completed')
                          and (b.start_time at time zone 'Asia/Jakarta')::date = today.d and (p_company is null or b.company = p_company)),
    'p2h_today', (select count(*) from public.fleet_p2h_inspections i, today
                    where (i.created_at at time zone 'Asia/Jakarta')::date = today.d and (p_company is null or i.company = p_company)),
    'p2h_result_30', (select coalesce(jsonb_object_agg(result, n), '{}') from (select result, count(*) n from p30 group by result) x),
    'p2h_avg_30', (select round(avg(score)) from p30),
    'repairs_open', (select count(*) from open_rep),
    'repairs_critical', (select count(*) from open_rep where is_critical),
    'docs_due', (select count(*) from v, today where status <> 'inactive' and (
                   tax_date <= today.d + 30 or kir_date <= today.d + 30 or plate_date <= today.d + 30)),
    'service_due', (select count(*) from v where status <> 'inactive' and last_service_odo + service_interval_km - odometer <= 500),
    'fuel_month', (select coalesce(sum(total_cost), 0) from public.fleet_fuel_logs f, today
                    where f.date >= date_trunc('month', today.d) and (p_company is null or f.company = p_company)),
    'repair_cost_month', (select coalesce(sum(actual_cost), 0) from public.fleet_repairs r, today
                    where r.status = 'done' and r.done_at >= date_trunc('month', today.d) and (p_company is null or r.company = p_company)),
    'p2h_daily', (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', n) order by d), '[]') from (
                    select (created_at at time zone 'Asia/Jakarta')::date d, count(*) n from p30
                    where created_at > now() - interval '14 days' group by 1) x)
  );
$$;
