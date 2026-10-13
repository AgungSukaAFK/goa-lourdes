-- View gabungan untuk list & pencarian (RLS tabel asal tetap berlaku).

create view public.asset_loans_view
with (security_invoker = true)
as
select
  l.*,
  a.code as asset_code,
  a.name as asset_name,
  e.name as borrower_name,
  e.nrp as borrower_nrp,
  e.position as borrower_position,
  rp.name as requested_by_name,
  dp.name as decided_by_name,
  (l.status = 'approved' and l.expected_return_date < (now() at time zone 'Asia/Jakarta')::date) as is_overdue
from public.asset_loans l
join public.assets a on a.id = l.asset_id
join public.employees e on e.id = l.borrower_employee_id
left join public.profiles rp on rp.id = l.requested_by
left join public.profiles dp on dp.id = l.decided_by;

create view public.asset_mutations_view
with (security_invoker = true)
as
select
  m.*,
  a.code as asset_code,
  a.name as asset_name,
  fe.name as from_name,
  fe.nrp as from_nrp,
  fe.position as from_position,
  te.name as to_name,
  te.nrp as to_nrp,
  te.position as to_position,
  fs.name as from_site_name,
  ts.name as to_site_name,
  rp.name as requested_by_name,
  dp.name as decided_by_name
from public.asset_mutations m
join public.assets a on a.id = m.asset_id
left join public.employees fe on fe.id = m.from_employee_id
left join public.employees te on te.id = m.to_employee_id
left join public.sites fs on fs.id = m.from_site_id
left join public.sites ts on ts.id = m.to_site_id
left join public.profiles rp on rp.id = m.requested_by
left join public.profiles dp on dp.id = m.decided_by;

create view public.asset_audits_view
with (security_invoker = true)
as
select
  au.*,
  a.code as asset_code,
  a.name as asset_name,
  a.status as asset_status,
  s.name as site_name,
  e.name as owner_name,
  rp.name as realized_by_name,
  (au.status = 'waiting' and au.due_date < (now() at time zone 'Asia/Jakarta')::date) as is_overdue
from public.asset_audits au
join public.assets a on a.id = au.asset_id
left join public.sites s on s.id = a.site_id
left join public.employees e on e.id = a.owner_employee_id
left join public.profiles rp on rp.id = au.realized_by;
