-- Un Viaje Astral · Portal de pacientes
-- 0009 · Habilitación de cuentas y gestión de perfiles
--
-- * Agrega estado de aprobación, email y trazabilidad al perfil.
-- * Los registros nuevos quedan pendientes hasta que un administrador los habilite.

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists approved_at timestamptz;

alter table public.profiles
  add column if not exists approved_by uuid references public.profiles (id) on delete set null;

do $$
declare
  v_has_status boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'status'
  ) into v_has_status;

  if not v_has_status then
    alter table public.profiles
      add column status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected', 'suspended'));

    -- Los perfiles que ya existían conservan el acceso.
    update public.profiles
    set status = 'approved',
        approved_at = coalesce(approved_at, now())
    where status = 'pending';
  end if;
end
$$;

-- Backfill de email para perfiles históricos.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create index if not exists profiles_status_created_idx
  on public.profiles (status, created_at desc);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- is_admin() ahora exige estado aprobado
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
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
      and role = 'admin'
      and status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- is_approved(): helper para RLS
-- ---------------------------------------------------------------------------
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
      and status = 'approved'
  );
$$;

revoke all on function public.is_approved() from public;
grant execute on function public.is_approved() to authenticated;

-- ---------------------------------------------------------------------------
-- Alta de perfil: email y estado pendiente
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_ref text;
  v_branch public.branches%rowtype;
begin
  v_branch_ref := lower(nullif(trim(new.raw_user_meta_data ->> 'branch_id'), ''));

  if v_branch_ref is null then
    v_branch_ref := lower(nullif(trim(new.raw_user_meta_data ->> 'branch_slug'), ''));
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
      and slug = 'parana'
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

  if v_branch.id is null then
    raise exception 'No hay sedes activas configuradas.';
  end if;

  insert into public.profiles (id, full_name, phone, role, branch_id, email, status)
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

-- ---------------------------------------------------------------------------
-- Protección del perfil: el paciente no puede autoaprobarse ni cambiar su email
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id then
    raise exception 'No se puede cambiar el identificador del perfil.';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Solo un administrador puede cambiar roles.';
    end if;

    if new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.email is distinct from old.email then
      raise exception 'Solo un administrador puede cambiar el estado del perfil.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- RLS: el catálogo y la documentación requieren cuenta aprobada
-- ---------------------------------------------------------------------------
drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "products_select_active_or_admin" on public.products;
create policy "products_select_authenticated"
on public.products for select
to authenticated
using (
  active = true
  and branch_id = public.current_branch_id()
  and public.is_approved()
);

-- patient_documents: solo cuentas aprobadas pueden operar sus documentos.
drop policy if exists "patient_documents_select_own" on public.patient_documents;
create policy "patient_documents_select_own"
on public.patient_documents for select
to authenticated
using (user_id = auth.uid() and public.is_approved());

drop policy if exists "patient_documents_insert_own" on public.patient_documents;
create policy "patient_documents_insert_own"
on public.patient_documents for insert
to authenticated
with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "patient_documents_update_own" on public.patient_documents;
create policy "patient_documents_update_own"
on public.patient_documents for update
to authenticated
using (user_id = auth.uid() and public.is_approved())
with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "patient_documents_delete_own" on public.patient_documents;
create policy "patient_documents_delete_own"
on public.patient_documents for delete
to authenticated
using (user_id = auth.uid() and public.is_approved());

-- Storage de documentación: lectura/escritura solo para cuentas aprobadas.
drop policy if exists "patient_documents_storage_select" on storage.objects;
create policy "patient_documents_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    ((storage.foldername(name))[1] = auth.uid()::text and public.is_approved())
    or public.is_admin()
  )
);

drop policy if exists "patient_documents_storage_insert" on storage.objects;
create policy "patient_documents_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'patient-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_approved()
);

drop policy if exists "patient_documents_storage_update" on storage.objects;
create policy "patient_documents_storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    ((storage.foldername(name))[1] = auth.uid()::text and public.is_approved())
    or public.is_admin()
  )
)
with check (
  bucket_id = 'patient-documents'
  and (
    ((storage.foldername(name))[1] = auth.uid()::text and public.is_approved())
    or public.is_admin()
  )
);

drop policy if exists "patient_documents_storage_delete" on storage.objects;
create policy "patient_documents_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    ((storage.foldername(name))[1] = auth.uid()::text and public.is_approved())
    or public.is_admin()
  )
);

-- ---------------------------------------------------------------------------
-- Pedidos: bloquear la creación si la cuenta no está aprobada
-- ---------------------------------------------------------------------------
create or replace function public.enforce_approved_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    if not exists (
      select 1
      from public.profiles
      where id = new.user_id
        and status = 'approved'
    ) then
      raise exception 'Tu cuenta todavía no está habilitada para hacer pedidos.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_require_approved on public.orders;
create trigger orders_require_approved
before insert on public.orders
for each row execute function public.enforce_approved_order();
