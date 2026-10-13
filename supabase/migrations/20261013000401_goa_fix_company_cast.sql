-- Perbaikan: company kendaraan (company_code) -> profile_company.

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
        public.next_doc_code('TSK'), v.company::text::public.profile_company, 'P2H mingguan ' || v.plate,
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
      values (v.company::text::public.profile_company, 'fleet', 'Perhatian ' || v.plate, array_to_string(v.items, ' · '), '/fleet/vehicles?doc=due', now() + interval '1 day');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
