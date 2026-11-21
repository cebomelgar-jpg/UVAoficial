-- Diferencia los nuevos solicitantes de adhesión de los pacientes que ya tienen REPROCANN.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text := lower(coalesce(trim(new.raw_user_meta_data ->> 'account_type'), ''));
  v_branch_ref text := lower(coalesce(trim(new.raw_user_meta_data ->> 'branch_id'), ''));
  v_branch public.branches%rowtype;
begin
  if v_account_type = 'adhesion_applicant' then
    insert into public.profiles (
      id, full_name, phone, role, branch_id, email, status
    )
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Solicitante'),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      'applicant',
      null,
      new.email,
      'pending'
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if v_branch_ref is not null then
    select *
    into v_branch
    from public.branches
    where active = true
      and (id::text = v_branch_ref or lower(slug) = v_branch_ref)
    limit 1;
  end if;

  if v_branch.id is null then
    select *
    into v_branch
    from public.branches
    where active = true
    order by sort_order, name
    limit 1;
  end if;

  insert into public.profiles (
    id, full_name, phone, role, branch_id, email, status
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Paciente'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'patient',
    v_branch.id,
    new.email,
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Solicitudes internas: problema operativo y pedido especial de producto.
alter table public.support_contact_requests
  add column if not exists details text;

alter table public.support_contact_requests
  drop constraint if exists support_contact_requests_request_type_check;

alter table public.support_contact_requests
  add constraint support_contact_requests_request_type_check
  check (request_type in (
    'password',
    'privacy',
    'general',
    'problem',
    'product'
  ));

create or replace function public.submit_support_contact_request(
  p_request_type text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_request_type not in (
    'password', 'privacy', 'general', 'problem', 'product'
  )
     or length(p_full_name) not between 2 and 80
     or length(p_email) not between 6 and 254
     or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or length(p_phone) not between 6 and 30
     or p_phone !~ '^[+0-9() .-]+$'
     or (p_details is not null and char_length(p_details) > 2000) then
    raise exception 'Revisá los datos de la solicitud ingresados.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(p_email), 0));
  if exists (
    select 1
    from public.support_contact_requests r
    where lower(r.email) = lower(p_email)
      and r.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Ya recibimos una solicitud reciente. Esperá unos minutos antes de volver a enviarla.';
  end if;

  insert into public.support_contact_requests (
    request_type, full_name, email, phone, details
  )
  values (
    p_request_type, btrim(p_full_name), lower(btrim(p_email)),
    btrim(p_phone), nullif(btrim(p_details), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_support_contact_request(text, text, text, text, text) from public;
grant execute on function public.submit_support_contact_request(text, text, text, text, text) to anon, authenticated;

-- Crea perfiles faltantes para cuentas existentes sin interferir con roles históricos.
insert into public.profiles (
  id, full_name, phone, role, branch_id, email, status
)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Paciente'
  ),
  nullif(trim(u.raw_user_meta_data ->> 'phone'), ''),
  'patient',
  (
    select b.id
    from public.branches b
    where b.active = true
    order by b.sort_order, b.name
    limit 1
  ),
  u.email,
  'pending'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and coalesce(lower(u.raw_user_meta_data ->> 'account_type'), '') <> 'adhesion_applicant';

commit;
