-- Un Viaje Astral · Portal de pacientes
-- 0007 · Multi-sede (Paraná y Villaguay)
--
-- Objetivo:
--   * Catálogos, pacientes y pedidos independientes por sede.
--   * Backfill seguro de los datos existentes en Paraná.
--   * RLS y create_order() con validación de sede.
--
-- Esta migración es incremental. No reescribe las migraciones históricas.
-- Si ya corriste apply-all.sql antes de esta versión, ejecutá solamente este
-- archivo en el SQL Editor de Supabase.

-- ---------------------------------------------------------------------------
-- Sedes
-- ---------------------------------------------------------------------------
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  city text not null,
  province text not null default 'Entre Ríos',
  address text,
  phone text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.branches (id, slug, name, city, province, address, sort_order)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'parana',
    'Paraná',
    'Paraná',
    'Entre Ríos',
    'Victoria 235, Paraná',
    10
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'villaguay',
    'Villaguay',
    'Villaguay',
    'Entre Ríos',
    null,
    20
  )
on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      city = excluded.city,
      province = excluded.province,
      address = excluded.address,
      sort_order = excluded.sort_order,
      active = true;

create index if not exists branches_active_sort_idx
  on public.branches (active, sort_order, name);

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

comment on table public.branches is 'Sedes operativas del portal. Cada sede tiene su propio catálogo.';
comment on column public.branches.slug is 'Identificador estable para filtros y enlaces, por ejemplo ?sede=villaguay.';

-- ---------------------------------------------------------------------------
-- Columnas de sede en perfiles, productos y pedidos
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists branch_id uuid references public.branches (id) on delete restrict;

alter table public.products
  add column if not exists branch_id uuid references public.branches (id) on delete restrict;

alter table public.orders
  add column if not exists branch_id uuid references public.branches (id) on delete restrict;

-- Los datos históricos quedan en Paraná. Luego un administrador puede
-- reasignar pacientes, productos o pedidos desde la operación habitual
-- (los productos y perfiles se pueden editar; los pedidos conservan la sede
-- con la que fueron creados).
update public.profiles
set branch_id = (
  select id from public.branches where slug = 'parana'
)
where branch_id is null;

update public.products
set branch_id = (
  select id from public.branches where slug = 'parana'
)
where branch_id is null;

update public.orders
set branch_id = coalesce(
  (
    select p.branch_id
    from public.profiles p
    where p.id = public.orders.user_id
  ),
  (
    select id from public.branches where slug = 'parana'
  )
)
where branch_id is null;

alter table public.products
  alter column branch_id set not null;

alter table public.profiles
  drop constraint if exists profiles_patient_branch_required;
alter table public.profiles
  add constraint profiles_patient_branch_required
  check (role <> 'patient' or branch_id is not null) not valid;
alter table public.profiles
  validate constraint profiles_patient_branch_required;

alter table public.orders
  alter column branch_id set not null;

-- El slug deja de ser único globalmente: cada sede puede repetirlo.
alter table public.products
  drop constraint if exists products_slug_key;
drop index if exists products_slug_key;

create unique index if not exists products_branch_slug_key
  on public.products (branch_id, slug);

create index if not exists profiles_branch_idx
  on public.profiles (branch_id);

create index if not exists products_branch_active_sort_idx
  on public.products (branch_id, active, sort_order, name);

create index if not exists products_branch_category_active_idx
  on public.products (branch_id, category, active);

create index if not exists orders_branch_created_idx
  on public.orders (branch_id, created_at desc);

create index if not exists orders_branch_status_created_idx
  on public.orders (branch_id, status, created_at desc);

comment on column public.profiles.branch_id is 'Sede del paciente (obligatoria para rol patient).';
comment on column public.products.branch_id is 'Sede dueña de esta ficha de catálogo.';
comment on column public.orders.branch_id is 'Sede del catálogo usado al crear el pedido.';

-- ---------------------------------------------------------------------------
-- Helpers de RLS
-- ---------------------------------------------------------------------------
create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_branch_id() from public;
grant execute on function public.current_branch_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Alta de perfil: la sede viene en los metadatos de auth o cae en Paraná
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

  insert into public.profiles (id, full_name, phone, role, branch_id)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Paciente'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'patient',
    v_branch.id
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
-- Creación atómica de pedidos, ahora validando la sede del catálogo
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_payment_method text,
  p_fulfillment_method text,
  p_contact_phone text,
  p_delivery_address text default null,
  p_notes text default null,
  p_therapeutic_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_quantity integer;
  v_contact_phone text;
  v_patient_email text;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para confirmar el pedido.';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'bank_transfer') then
    raise exception 'Método de pago inválido.';
  end if;

  if p_fulfillment_method is null or p_fulfillment_method not in ('pickup', 'delivery') then
    raise exception 'Método de entrega inválido.';
  end if;

  if p_fulfillment_method = 'delivery'
     and nullif(trim(p_delivery_address), '') is null then
    raise exception 'Ingresá una dirección para la entrega.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'No encontramos tu perfil de paciente.';
  end if;

  if v_profile.role <> 'patient' then
    raise exception 'Solo los pacientes pueden confirmar pedidos.';
  end if;

  if v_profile.branch_id is null then
    raise exception 'Tu perfil no tiene una sede asignada. Contactá a la asociación.';
  end if;

  v_contact_phone := coalesce(nullif(trim(p_contact_phone), ''), v_profile.phone);
  if v_contact_phone is null or length(v_contact_phone) < 6 then
    raise exception 'Ingresá un teléfono de contacto.';
  end if;

  select email into v_patient_email
  from auth.users
  where id = v_user_id;

  -- Primera pasada: bloquear filas, validar stock y calcular el total real.
  for v_item in
    select
      (value ->> 'product_id')::uuid as product_id,
      sum(coalesce((value ->> 'quantity')::integer, 0))::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1
  loop
    if v_item.product_id is null then
      raise exception 'Uno de los productos del carrito es inválido.';
    end if;

    v_quantity := v_item.quantity;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'La cantidad de uno de los productos es inválida.';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id
      and branch_id = v_profile.branch_id
      and active = true
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible en tu sede.';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'Stock insuficiente para %.', v_product.name;
    end if;

    v_total := v_total + (v_product.price * v_quantity);
  end loop;

  if v_total <= 0 then
    raise exception 'El total del pedido no puede ser cero. Contactá a la asociación.';
  end if;

  insert into public.orders (
    user_id,
    branch_id,
    patient_name,
    patient_email,
    status,
    payment_method,
    payment_status,
    fulfillment_method,
    contact_phone,
    delivery_address,
    subtotal,
    total,
    notes,
    therapeutic_notes
  )
  values (
    v_user_id,
    v_profile.branch_id,
    v_profile.full_name,
    v_patient_email,
    'pending',
    p_payment_method,
    'pending',
    p_fulfillment_method,
    v_contact_phone,
    nullif(trim(p_delivery_address), ''),
    v_total,
    v_total,
    nullif(trim(p_notes), ''),
    nullif(trim(p_therapeutic_notes), '')
  )
  returning id into v_order_id;

  -- Segunda pasada: guardar el detalle histórico y descontar stock.
  for v_item in
    select
      (value ->> 'product_id')::uuid as product_id,
      sum(coalesce((value ->> 'quantity')::integer, 0))::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
      and branch_id = v_profile.branch_id
      and active = true
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible en tu sede.';
    end if;

    if v_product.stock < v_item.quantity then
      raise exception 'Stock insuficiente para %.', v_product.name;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      product_slug,
      category,
      image_url,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.slug,
      v_product.category,
      v_product.image_url,
      v_product.price,
      v_item.quantity,
      v_product.price * v_item.quantity
    );

    update public.products
    set stock = stock - v_item.quantity,
        updated_at = now()
    where id = v_product.id;
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text, text) from public;
grant execute on function public.create_order(jsonb, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security por sede
-- ---------------------------------------------------------------------------

-- Sedes: todo el mundo puede leer las activas (lo necesita el registro).
-- Los administradores ven también las inactivas.
alter table public.branches enable row level security;

-- Eliminar las políticas globales de la versión anterior. Sin esto, las
-- políticas se suman con OR y un paciente podría ver catálogos de otra sede.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "products_select_active_or_admin" on public.products;
drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;
drop policy if exists "orders_select_own_or_admin" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;
drop policy if exists "order_items_select_own_or_admin" on public.order_items;

drop policy if exists "branches_select_active" on public.branches;
create policy "branches_select_active"
on public.branches for select
to anon, authenticated
using (active = true);

drop policy if exists "branches_select_admin" on public.branches;
create policy "branches_select_admin"
on public.branches for select
to authenticated
using (public.is_admin());

drop policy if exists "branches_insert_admin" on public.branches;
create policy "branches_insert_admin"
on public.branches for insert
to authenticated
with check (public.is_admin());

drop policy if exists "branches_update_admin" on public.branches;
create policy "branches_update_admin"
on public.branches for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Perfiles: cada paciente ve su perfil; el administrador ve todos. Un paciente
-- sólo puede cambiar su sede a otra sede activa.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid() and role = 'patient')
with check (
  id = auth.uid()
  and role = 'patient'
  and branch_id is not null
  and exists (
    select 1 from public.branches b
    where b.id = branch_id and b.active = true
  )
);

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Productos: el paciente sólo ve el catálogo activo de su sede. El admin
-- puede operar cualquier sede y la vista filtra por ?sede=.
drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products for select
to authenticated
using (
  active = true
  and branch_id = public.current_branch_id()
);

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Pedidos: el paciente conserva su historial completo aunque cambie de sede.
-- El administrador puede ver y operar pedidos de todas las sedes.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
on public.orders for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
on public.orders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Mantener las políticas de order_items, pero alineadas al pedido.
drop policy if exists "order_items_select_accessible" on public.order_items;
create policy "order_items_select_accessible"
on public.order_items for select
to authenticated
using (public.can_access_order(order_id));
