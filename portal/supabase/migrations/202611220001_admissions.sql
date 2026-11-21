-- Solicitudes de adhesión: una cuenta pública nueva nunca obtiene rol de paciente.
begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('patient', 'admin', 'applicant'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone,
    role,
    branch_id,
    email,
    status
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Solicitante'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'applicant',
    null,
    new.email,
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('patient', 'admin')
      and status = 'approved'
  );
$$;

revoke all on function public.is_approved() from public;
grant execute on function public.is_approved() to authenticated;

create table if not exists public.adhesion_applications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clinical_reason text not null check (length(trim(clinical_reason)) between 2 and 2000),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  age smallint not null check (age between 18 and 120),
  dni text not null check (dni ~ '^[0-9]{7,10}$'),
  birth_date date not null,
  address text not null check (length(trim(address)) between 3 and 200),
  locality text not null check (length(trim(locality)) between 2 and 120),
  email text not null check (length(email) between 6 and 254),
  health_insurance text not null check (length(trim(health_insurance)) between 2 and 120),
  phone text not null check (length(trim(phone)) between 6 and 30),
  completed_steps integer[] not null default '{}'
    check (cardinality(completed_steps) <= 6)
    check (completed_steps <@ array[1, 2, 3, 4, 5, 6]::integer[]),
  current_step smallint not null default 1 check (current_step between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adhesion_applications_updated_idx
  on public.adhesion_applications (updated_at desc);

drop trigger if exists adhesion_applications_set_updated_at on public.adhesion_applications;
create trigger adhesion_applications_set_updated_at
before update on public.adhesion_applications
for each row execute function public.set_updated_at();

alter table public.adhesion_applications enable row level security;

create or replace function public.is_applicant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'applicant'
      and status in ('pending', 'rejected')
  );
$$;

revoke all on function public.is_applicant() from public;
grant execute on function public.is_applicant() to authenticated;

drop policy if exists "adhesion_applications_select_owner_or_admin"
  on public.adhesion_applications;
create policy "adhesion_applications_select_owner_or_admin"
  on public.adhesion_applications for select to authenticated
  using (user_id = auth.uid() and public.is_applicant() or public.is_admin());

drop policy if exists "adhesion_applications_insert_owner"
  on public.adhesion_applications;
create policy "adhesion_applications_insert_owner"
  on public.adhesion_applications for insert to authenticated
  with check (user_id = auth.uid() and public.is_applicant());

drop policy if exists "adhesion_applications_update_owner_or_admin"
  on public.adhesion_applications;
create policy "adhesion_applications_update_owner_or_admin"
  on public.adhesion_applications for update to authenticated
  using (user_id = auth.uid() and public.is_applicant() or public.is_admin())
  with check (user_id = auth.uid() and public.is_applicant() or public.is_admin());

revoke all on public.adhesion_applications from anon, public;
grant select, insert, update on public.adhesion_applications to authenticated;

commit;
