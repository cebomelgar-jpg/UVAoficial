-- Un Viaje Astral · Portal de pacientes
-- Bootstrap manual: ejecuta todas las migraciones en orden.
-- Archivo generado desde supabase/migrations/. No editar a mano.

begin;

-- ===========================================================================
-- 202610250001_initial_schema.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0001 · Esquema base
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'patient' check (role in ('patient', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('flores', 'rosin_hash', 'vapes')),
  description text,
  thc text,
  cbd text,
  sativa_percent integer check (sativa_percent is null or sativa_percent between 0 and 100),
  indica_percent integer check (indica_percent is null or indica_percent between 0 and 100),
  aromas text[] not null default '{}',
  flavors text[] not null default '{}',
  effects text[] not null default '{}',
  price numeric(12, 2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  presentation text,
  image_url text,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid references public.profiles (id) on delete set null,
  patient_name text not null,
  patient_email text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')),
  payment_method text not null
    check (payment_method in ('cash', 'bank_transfer')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'cancelled')),
  fulfillment_method text not null default 'pickup'
    check (fulfillment_method in ('pickup', 'delivery')),
  contact_phone text not null,
  delivery_address text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  notes text,
  therapeutic_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_slug text,
  category text check (category is null or category in ('flores', 'rosin_hash', 'vapes')),
  image_url text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists products_category_active_idx on public.products (category, active);
create index if not exists products_sort_idx on public.products (sort_order, name);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

comment on table public.profiles is 'Perfiles de pacientes y administradores del portal.';
comment on table public.products is 'Catálogo privado de flores secas, rosin hash y vapes.';
comment on table public.orders is 'Pedidos realizados por pacientes registrados.';
comment on table public.order_items is 'Detalle histórico de productos por pedido.';

-- ===========================================================================
-- 202610250002_rls.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0002 · Row Level Security
-- El catálogo es privado: sólo usuarios autenticados y administradores pueden leerlo.

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
  );
$$;

create or replace function public.can_access_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders
    where id = p_order_id
      and (user_id = auth.uid() or public.is_admin())
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.can_access_order(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_order(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
on public.profiles for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
drop policy if exists "products_select_active_or_admin" on public.products;
create policy "products_select_active_or_admin"
on public.products for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert
to authenticated
with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
on public.orders for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Los pacientes crean pedidos exclusivamente mediante create_order()
-- y los cancelan mediante cancel_order(). No hay políticas de INSERT/DELETE.

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
on public.order_items for select
to authenticated
using (public.can_access_order(order_id));

-- ===========================================================================
-- 202610250003_functions.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0003 · Funciones de negocio y triggers
-- Los precios y el stock siempre se validan en el servidor.

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Paciente'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'patient'
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
-- Protección contra escalada de roles
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

  if new.role <> old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Creación atómica de pedidos
-- p_items: [{"product_id": "uuid", "quantity": 1}, ...]
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
      and active = true
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible.';
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
      and active = true
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible.';
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

-- ---------------------------------------------------------------------------
-- Cancelación por parte del paciente
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'El pedido no existe.';
  end if;

  if v_order.user_id <> auth.uid() then
    raise exception 'No tenés permiso para cancelar este pedido.';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Solo podés cancelar pedidos pendientes.';
  end if;

  update public.orders
  set status = 'cancelled',
      payment_status = 'cancelled'
  where id = p_order_id;

  for v_item in
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
  loop
    if v_item.product_id is not null then
      update public.products
      set stock = stock + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cambio de estado por parte del administrador
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'No tenés permisos de administrador.';
  end if;

  if p_status is null
     or p_status not in ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled') then
    raise exception 'Estado de pedido inválido.';
  end if;

  if p_payment_status is null
     or p_payment_status not in ('pending', 'paid', 'cancelled') then
    raise exception 'Estado de pago inválido.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'El pedido no existe.';
  end if;

  if v_order.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'Un pedido cancelado no se puede reactivar.';
  end if;

  if p_status = 'cancelled' and v_order.status <> 'cancelled' then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        update public.products
        set stock = stock + v_item.quantity,
            updated_at = now()
        where id = v_item.product_id;
      end if;
    end loop;
  end if;

  update public.orders
  set status = p_status,
      payment_status = case
        when p_status = 'cancelled' then 'cancelled'
        else p_payment_status
      end
  where id = p_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text, text) from public;
revoke all on function public.cancel_order(uuid) from public;
revoke all on function public.admin_update_order_status(uuid, text, text) from public;
grant execute on function public.create_order(jsonb, text, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.admin_update_order_status(uuid, text, text) to authenticated;

-- ===========================================================================
-- 202610250004_storage.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0004 · Storage para imágenes de catálogo

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- ===========================================================================
-- 202610250005_realtime.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0005 · Realtime para pedidos y catálogo

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'products'
    ) then
      alter publication supabase_realtime add table public.products;
    end if;
  end if;
end
$$;

-- ===========================================================================
-- 202610250006_seed_catalog.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0006 · Catálogo inicial
--
-- IMPORTANTE:
-- Los productos se cargan con precio 0, stock 0 y active = false para que el
-- administrador complete precios, stock y disponibilidad desde /admin/catalogo.
-- No inventamos precios ni concentraciones que no estén publicadas.
-- La ficha "Genética 07 · A definir" y las fichas de vapes quedan reservadas
-- para que el administrador las complete sin tocar código.
--
-- El seed es idempotente en ambos esquemas:
--   * Antes de la migración multi-sede usa `on conflict (slug)`.
--   * Después de la migración multi-sede detecta `products.branch_id` y carga
--     el catálogo en Paraná con `on conflict (branch_id, slug)`.
-- Así se puede volver a ejecutar sin romper la restricción NOT NULL ni la
-- unicidad compuesta.

drop table if exists _seed_catalog;

create temp table _seed_catalog (
  slug text primary key,
  name text not null,
  category text not null,
  description text,
  thc text,
  cbd text,
  sativa_percent integer,
  indica_percent integer,
  aromas text[] not null,
  flavors text[] not null,
  effects text[] not null,
  price numeric(12, 2) not null,
  stock integer not null,
  presentation text,
  image_url text,
  active boolean not null,
  featured boolean not null,
  sort_order integer not null
);

insert into _seed_catalog (
  slug, name, category, description, thc, cbd, sativa_percent, indica_percent,
  aromas, flavors, effects, price, stock, presentation, image_url, active, featured, sort_order
)
values
  (
    'runtz', 'Runtz', 'flores',
    'Aromas y sabores afrutados y dulces. Efecto relajante.',
    '23–26%', null, null, null,
    array['Afrutado', 'Dulce'], array['Frutal', 'Dulce'], array['Relajante'],
    0, 0, 'Flores secas', '/products/runtz.webp', false, false, 10
  ),
  (
    'green-poison', 'Green Poison', 'flores',
    'Aromas y sabores afrutados, especiados, skunk y dulces. Efectos relajantes y creativos.',
    '15–20%', null, null, null,
    array['Afrutado', 'Especiado', 'Skunk', 'Dulce'],
    array['Frutal', 'Especiado', 'Skunk', 'Dulce'],
    array['Relajante', 'Creatividad'],
    0, 0, 'Flores secas', '/products/green-poison.webp', false, false, 20
  ),
  (
    'sweet-mandarine-zkittlez', 'Sweet Mandarine Zkittlez', 'flores',
    'Aromas y sabores dulces, diesel, especiados, naranja, mango, pino y frescos. Efectos estimulantes, creatividad y bienestar.',
    '19–24%', null, null, null,
    array['Dulce', 'Diesel', 'Especiado', 'Naranja', 'Mango', 'Pino'],
    array['Dulce', 'Diesel', 'Naranja', 'Mango', 'Pino', 'Fresco'],
    array['Estimulante', 'Creatividad', 'Bienestar'],
    0, 0, 'Flores secas', '/products/sweet-mandarine-zkittlez.webp', false, false, 30
  ),
  (
    'cream-mandarine', 'Cream Mandarine', 'flores',
    'Aromas y sabores de frutos rojos, agrios, cítricos, mandarina y agridulces. Efectos psicoactivos, creativos, estimulantes y relajantes.',
    '18–20%', null, null, null,
    array['Frutos rojos', 'Cítrico', 'Mandarina', 'Agridulce'],
    array['Frutos rojos', 'Agrio', 'Cítrico', 'Mandarina', 'Agridulce'],
    array['Creatividad', 'Estimulante', 'Relajante'],
    0, 0, 'Flores secas', '/products/cream-mandarine.webp', false, false, 40
  ),
  (
    'cbd-compassion-lime', 'CBD Compassion Lime', 'flores',
    'Aromas y sabores cítricos, lima y picantes. Efectos corporales con psicoactividad reducida.',
    null, '13,5%', null, null,
    array['Cítrico', 'Lima', 'Picante'],
    array['Cítrico', 'Lima', 'Picante'],
    array['Corporal', 'Psicoactividad reducida'],
    0, 0, 'Flores secas', '/products/cbd-compassion-lime.webp', false, false, 50
  ),
  (
    'red-pure-cbd', 'Red Pure CBD', 'flores',
    'Aromas y sabores de ciprés, terroso, pino, fresco, frutos del bosque y dulce. Efectos relajantes.',
    '0,4–0,5%', '15–17%', null, null,
    array['Ciprés', 'Terroso', 'Pino', 'Frutos del bosque', 'Dulce'],
    array['Ciprés', 'Terroso', 'Pino', 'Fresco', 'Frutos del bosque', 'Dulce'],
    array['Relajante'],
    0, 0, 'Flores secas', '/products/red-pure-cbd.webp', false, false, 60
  ),
  (
    'genetica-07-a-definir', 'Genética 07 · A definir', 'flores',
    'Ficha reservada para una nueva genética. Completá nombre, cannabinoides, proporción sativa/indica, aromas, sabores, precio y stock desde el panel de administración.',
    null, null, null, null,
    array[]::text[], array[]::text[], array[]::text[],
    0, 0, 'Flores secas', null, false, false, 70
  ),
  (
    'rosin-hash', 'Rosin Hash', 'rosin_hash',
    'Extracción libre de solventes químicos a partir de hash. Alta pureza y libre de residuos. Consultá las genéticas disponibles.',
    null, null, null, null,
    array[]::text[], array[]::text[], array[]::text[],
    0, 0, 'Extracción sin solventes', '/products/rosin-hash.webp', false, false, 10
  ),
  (
    'rosin-de-flor', 'Rosin de Flor', 'rosin_hash',
    'Extracción libre de solventes químicos a partir de flores. Alta pureza y libre de residuos. Consultá las genéticas disponibles.',
    null, null, null, null,
    array[]::text[], array[]::text[], array[]::text[],
    0, 0, 'Extracción sin solventes', '/products/rosin-de-flor.webp', false, false, 20
  ),
  (
    'vape-01-a-definir', 'Vape 01 · A definir', 'vapes',
    'Ficha reservada para un producto de vaporización. Completá nombre, cannabinoides, perfil de aromas, precio y stock desde el panel de administración.',
    null, null, null, null,
    array[]::text[], array[]::text[], array[]::text[],
    0, 0, 'Vape', '/products/vape-placeholder.svg', false, false, 10
  ),
  (
    'vape-02-a-definir', 'Vape 02 · A definir', 'vapes',
    'Ficha reservada para un segundo producto de vaporización. Completá nombre, cannabinoides, perfil de aromas, precio y stock desde el panel de administración.',
    null, null, null, null,
    array[]::text[], array[]::text[], array[]::text[],
    0, 0, 'Vape', '/products/vape-placeholder.svg', false, false, 20
  );

do $$
declare
  v_has_branch boolean;
  v_branch_id uuid;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'branch_id'
  ) into v_has_branch;

  if v_has_branch then
    select id into v_branch_id
    from public.branches
    where slug = 'parana';

    if v_branch_id is null then
      raise exception
        'No existe la sede Paraná. Aplicá la migración multi-sede antes de re-ejecutar el seed.';
    end if;

    insert into public.products (
      branch_id, slug, name, category, description, thc, cbd,
      sativa_percent, indica_percent, aromas, flavors, effects,
      price, stock, presentation, image_url, active, featured, sort_order
    )
    select
      v_branch_id, slug, name, category, description, thc, cbd,
      sativa_percent, indica_percent, aromas, flavors, effects,
      price, stock, presentation, image_url, active, featured, sort_order
    from _seed_catalog
    on conflict (branch_id, slug) do nothing;
  else
    insert into public.products (
      slug, name, category, description, thc, cbd,
      sativa_percent, indica_percent, aromas, flavors, effects,
      price, stock, presentation, image_url, active, featured, sort_order
    )
    select
      slug, name, category, description, thc, cbd,
      sativa_percent, indica_percent, aromas, flavors, effects,
      price, stock, presentation, image_url, active, featured, sort_order
    from _seed_catalog
    on conflict (slug) do nothing;
  end if;
end
$$;

drop table if exists _seed_catalog;

-- ===========================================================================
-- 202610260001_multi_branch.sql
-- ===========================================================================
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

-- ===========================================================================
-- 202610270001_patient_documents.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0008 · Documentación del paciente
--
-- Cada paciente puede subir un archivo vigente por tipo de documento:
--   * tramite   → certificado de trámite habilitado
--   * reprocann → credencial REPROCANN
--
-- Los archivos viven en un bucket privado. Solo el propio paciente y los
-- administradores pueden leerlos.

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null
    check (document_type in ('tramite', 'reprocann')),
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_type)
);

drop trigger if exists patient_documents_set_updated_at on public.patient_documents;
create trigger patient_documents_set_updated_at
before update on public.patient_documents
for each row execute function public.set_updated_at();

comment on table public.patient_documents is
  'Documentación privada del paciente: certificado de trámite habilitado y credencial REPROCANN.';
comment on column public.patient_documents.file_path is
  'Ruta del archivo dentro del bucket privado patient-documents.';

alter table public.patient_documents enable row level security;

drop policy if exists "patient_documents_select_own" on public.patient_documents;
create policy "patient_documents_select_own"
on public.patient_documents for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "patient_documents_insert_own" on public.patient_documents;
create policy "patient_documents_insert_own"
on public.patient_documents for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "patient_documents_update_own" on public.patient_documents;
create policy "patient_documents_update_own"
on public.patient_documents for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "patient_documents_delete_own" on public.patient_documents;
create policy "patient_documents_delete_own"
on public.patient_documents for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "patient_documents_admin_all" on public.patient_documents;
create policy "patient_documents_admin_all"
on public.patient_documents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Cada paciente opera únicamente su carpeta `<uid>/...`. Los administradores
-- pueden leer y administrar todos los archivos.
drop policy if exists "patient_documents_storage_select" on storage.objects;
create policy "patient_documents_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
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
);

drop policy if exists "patient_documents_storage_update" on storage.objects;
create policy "patient_documents_storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'patient-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
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
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);


-- ===========================================================================
-- 202610280001_profile_approval.sql
-- ===========================================================================
-- Un Viaje Astral · Portal de pacientes
-- 0009 · Habilitación de cuentas y gestión de perfiles
--
-- * Agrega estado de aprobación, email y trazabilidad al perfil.
-- * Los registros nuevos quedan pendientes hasta que un administrador los habilite.
-- * Guarda una copia cifrada de la contraseña para que el administrador pueda
--   consultarla y restablecerla. La contraseña de Supabase Auth sigue siendo
--   la fuente de verdad para el login.

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

-- ---------------------------------------------------------------------------
-- Endurecimiento de aprobación y eliminación de copias de contraseñas
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column status set default 'pending';

update public.profiles
set status = 'pending'
where status is null;

alter table public.profiles
  alter column status set not null;

drop table if exists public.profile_credentials;

-- ---------------------------------------------------------------------------
-- Publicación Realtime para el panel administrativo de perfiles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'No existe la publicación supabase_realtime.';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;


-- Chat E2E y solicitudes internas con retención limitada
-- E2E encrypted, short-lived patient/admin conversations and internal requests.

create table if not exists public.support_chat_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  public_key text not null check (length(public_key) between 80 and 256),
  created_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  constraint support_conversation_participants_differ check (patient_id <> admin_id)
);

create index if not exists support_conversations_patient_expiry_idx
  on public.support_conversations (patient_id, expires_at desc);
create index if not exists support_conversations_admin_expiry_idx
  on public.support_conversations (admin_id, expires_at desc);

create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null
    check (length(ciphertext) between 24 and 8000)
    check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'),
  iv text not null
    check (length(iv) = 16)
    check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  created_at timestamptz not null default now()
);

create index if not exists support_chat_messages_conversation_created_idx
  on public.support_chat_messages (conversation_id, created_at);

create table if not exists public.support_contact_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null
    check (request_type in ('password', 'privacy', 'general')),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  email text not null check (length(email) between 6 and 254),
  phone text not null check (length(phone) between 6 and 30),
  status text not null default 'pending'
    check (status in ('pending', 'handled')),
  created_at timestamptz not null default now()
);

create index if not exists support_contact_requests_created_idx
  on public.support_contact_requests (created_at desc);

alter table public.support_chat_keys enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_chat_messages enable row level security;
alter table public.support_contact_requests enable row level security;

create or replace function public.primary_support_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where role = 'admin' and status = 'approved'
  order by created_at, id
  limit 1;
$$;

revoke all on function public.primary_support_admin_id() from public;
grant execute on function public.primary_support_admin_id() to authenticated;

drop policy if exists "support_chat_keys_select" on public.support_chat_keys;
create policy "support_chat_keys_select"
  on public.support_chat_keys for select to authenticated
  using (
    public.is_approved()
    and (
      user_id = auth.uid()
      or public.is_admin()
      or user_id = public.primary_support_admin_id()
    )
  );

drop policy if exists "support_chat_keys_insert_own" on public.support_chat_keys;
create policy "support_chat_keys_insert_own"
  on public.support_chat_keys for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "support_conversations_select_participant" on public.support_conversations;
create policy "support_conversations_select_participant"
  on public.support_conversations for select to authenticated
  using (
    public.is_approved()
    and expires_at > now()
    and (
      patient_id = auth.uid()
      or (admin_id = auth.uid() and public.is_admin())
    )
  );

drop policy if exists "support_chat_messages_select_participant" on public.support_chat_messages;
create policy "support_chat_messages_select_participant"
  on public.support_chat_messages for select to authenticated
  using (
    public.is_approved()
    and exists (
      select 1
      from public.support_conversations c
      where c.id = conversation_id
        and c.expires_at > now()
        and (
          c.patient_id = auth.uid()
          or (c.admin_id = auth.uid() and public.is_admin())
        )
    )
  );

drop policy if exists "support_chat_messages_insert_participant" on public.support_chat_messages;
create policy "support_chat_messages_insert_participant"
  on public.support_chat_messages for insert to authenticated
  with check (
    public.is_approved()
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.support_conversations c
      where c.id = conversation_id
        and c.expires_at > now()
        and (
          c.patient_id = auth.uid()
          or (c.admin_id = auth.uid() and public.is_admin())
        )
    )
  );

drop policy if exists "support_contact_requests_admin_select" on public.support_contact_requests;
create policy "support_contact_requests_admin_select"
  on public.support_contact_requests for select to authenticated
  using (public.is_admin());

drop policy if exists "support_contact_requests_admin_update" on public.support_contact_requests;
create policy "support_contact_requests_admin_update"
  on public.support_contact_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "support_contact_requests_admin_delete" on public.support_contact_requests;
create policy "support_contact_requests_admin_delete"
  on public.support_contact_requests for delete to authenticated
  using (public.is_admin());

create or replace function public.open_support_conversation()
returns table (
  id uuid,
  patient_id uuid,
  admin_id uuid,
  created_at timestamptz,
  last_activity_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := auth.uid();
  v_admin_id uuid;
  v_conversation public.support_conversations%rowtype;
begin
  if v_patient_id is null or not exists (
    select 1 from public.profiles
    where profiles.id = v_patient_id
      and profiles.role = 'patient'
      and profiles.status = 'approved'
  ) then
    raise exception 'Solo pacientes habilitados pueden abrir un chat.';
  end if;

  perform 1 from public.profiles where profiles.id = v_patient_id for update;
  v_admin_id := public.primary_support_admin_id();

  if v_admin_id is null or not exists (
    select 1 from public.support_chat_keys where user_id = v_admin_id
  ) then
    raise exception 'El chat todavía no está habilitado por administración.';
  end if;

  select *
    into v_conversation
    from public.support_conversations c
    where c.patient_id = v_patient_id
      and c.expires_at > now()
    order by c.created_at desc
    limit 1;

  if found then
    return query
      select v_conversation.id, v_conversation.patient_id, v_conversation.admin_id,
        v_conversation.created_at, v_conversation.last_activity_at, v_conversation.expires_at;
    return;
  end if;

  delete from public.support_conversations c
  where c.patient_id = v_patient_id
    and c.expires_at <= now();

  insert into public.support_conversations (patient_id, admin_id)
  values (v_patient_id, v_admin_id)
  returning * into v_conversation;

  return query
    select v_conversation.id, v_conversation.patient_id, v_conversation.admin_id,
      v_conversation.created_at, v_conversation.last_activity_at, v_conversation.expires_at;
end;
$$;

revoke all on function public.open_support_conversation() from public, anon;
grant execute on function public.open_support_conversation() to authenticated;

create or replace function public.reset_support_chat_key()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles
    where id = v_user_id and status = 'approved'
  ) then
    raise exception 'Se requiere una cuenta habilitada.';
  end if;

  if exists (
    select 1 from public.support_conversations c
    where c.expires_at > now()
      and (c.patient_id = v_user_id or c.admin_id = v_user_id)
  ) then
    raise exception 'Esperá a que venza la conversación activa antes de restablecer la clave.';
  end if;

  delete from public.support_chat_keys where user_id = v_user_id;
end;
$$;

revoke all on function public.reset_support_chat_key() from public, anon;
grant execute on function public.reset_support_chat_key() to authenticated;

create or replace function public.record_support_chat_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved()
     or new.sender_id <> auth.uid()
     or new.ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$'
     or new.iv !~ '^[A-Za-z0-9+/]{16}$' then
    raise exception 'Mensaje cifrado inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text, 0));
  if (
    select count(*)
    from public.support_chat_messages m
    where m.conversation_id = new.conversation_id
      and m.sender_id = new.sender_id
      and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Alcanzaste el límite temporal de mensajes. Esperá un minuto.';
  end if;

  update public.support_conversations c
  set last_activity_at = now(),
      expires_at = now() + interval '60 minutes'
  where c.id = new.conversation_id
    and c.expires_at > now()
    and (c.patient_id = new.sender_id or c.admin_id = new.sender_id);

  if not found then
    raise exception 'El chat venció o no pertenece a esta cuenta.';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists support_chat_message_activity on public.support_chat_messages;
create trigger support_chat_message_activity
  before insert on public.support_chat_messages
  for each row execute function public.record_support_chat_activity();

create or replace function public.submit_support_contact_request(
  p_request_type text,
  p_full_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text := lower(trim(coalesce(p_request_type, '')));
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_id uuid;
begin
  if v_type not in ('password', 'privacy', 'general')
     or length(v_name) not between 2 and 80
     or length(v_email) not between 6 and 254
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or length(v_phone) not between 6 and 30
     or v_phone !~ '^[+0-9() .-]+$' then
    raise exception 'Revisá los datos de contacto ingresados.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  if exists (
    select 1 from public.support_contact_requests r
    where lower(r.email) = v_email
      and r.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Ya recibimos una solicitud reciente. Esperá unos minutos antes de volver a enviarla.';
  end if;

  insert into public.support_contact_requests (request_type, full_name, email, phone)
  values (v_type, v_name, v_email, v_phone)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_support_contact_request(text, text, text, text) from public;
grant execute on function public.submit_support_contact_request(text, text, text, text) to anon, authenticated;

revoke all on public.support_chat_keys, public.support_conversations,
  public.support_chat_messages, public.support_contact_requests from anon, authenticated;
grant select, insert on public.support_chat_keys to authenticated;
grant select on public.support_conversations to authenticated;
grant select, insert on public.support_chat_messages to authenticated;
grant select, update, delete on public.support_contact_requests to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'uva-cleanup-ephemeral-support'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'uva-cleanup-ephemeral-support',
    '* * * * *',
    $job$
      do $cleanup$
      begin
        delete from public.support_conversations where expires_at <= now();
        delete from public.support_contact_requests
        where created_at < now() - interval '7 days';
      end
      $cleanup$;
    $job$
  );
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_chat_messages'
  ) then
    alter publication supabase_realtime add table public.support_chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table public.support_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'support_contact_requests'
  ) then
    alter publication supabase_realtime add table public.support_contact_requests;
  end if;
end
$$;

-- ===========================================================================
-- 202611200004_secure_patient_document_uploads.sql
-- ===========================================================================
-- Restrict document writes to the validated server action.

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
where id = 'patient-documents';

drop policy if exists "patient_documents_storage_select" on storage.objects;
create policy "patient_documents_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'patient-documents'
  and (
    public.is_admin()
    or (
      public.is_approved()
      and exists (
        select 1
        from public.patient_documents document
        where document.user_id = auth.uid()
          and document.file_path = storage.objects.name
      )
    )
  )
);

drop policy if exists "patient_documents_storage_insert" on storage.objects;
drop policy if exists "patient_documents_storage_update" on storage.objects;
drop policy if exists "patient_documents_storage_delete" on storage.objects;

-- Un Viaje Astral · Portal de pacientes
-- 202611210001 · Privacidad del catálogo y productos derivados
alter table public.products
  add column if not exists made_to_order boolean not null default false;

alter table public.products
  drop constraint if exists products_category_check;
alter table public.products
  add constraint products_category_check
  check (category in ('flores', 'rosin_hash', 'vapes', 'derivados'));

alter table public.order_items
  drop constraint if exists order_items_category_check;
alter table public.order_items
  add constraint order_items_category_check
  check (
    category is null
    or category in ('flores', 'rosin_hash', 'vapes', 'derivados')
  );

revoke select on public.products from public, anon, authenticated;
revoke select (stock) on public.products from public, anon, authenticated;
grant select (
  id,
  branch_id,
  slug,
  name,
  category,
  description,
  thc,
  cbd,
  sativa_percent,
  indica_percent,
  aromas,
  flavors,
  effects,
  price,
  made_to_order,
  presentation,
  image_url,
  active,
  featured,
  sort_order,
  created_at,
  updated_at
) on public.products to authenticated;

create or replace function public.catalog_products(
  p_branch_id uuid,
  p_category text default null,
  p_featured_only boolean default false
)
returns table (
  id uuid,
  branch_id uuid,
  slug text,
  name text,
  category text,
  description text,
  thc text,
  cbd text,
  sativa_percent integer,
  indica_percent integer,
  aromas text[],
  flavors text[],
  effects text[],
  price numeric,
  available boolean,
  made_to_order boolean,
  presentation text,
  image_url text,
  active boolean,
  featured boolean,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or (
    not public.is_admin()
    and (
      not public.is_approved()
      or p_branch_id is distinct from public.current_branch_id()
    )
  ) then
    raise exception 'No tenés permiso para consultar este catálogo.'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.branch_id,
    p.slug,
    p.name,
    p.category,
    p.description,
    p.thc,
    p.cbd,
    p.sativa_percent,
    p.indica_percent,
    p.aromas,
    p.flavors,
    p.effects,
    p.price,
    p.stock > 0,
    p.made_to_order,
    p.presentation,
    p.image_url,
    p.active,
    p.featured,
    p.sort_order,
    p.created_at,
    p.updated_at
  from public.products p
  where p.active
    and p.branch_id = p_branch_id
    and (p_category is null or p.category = p_category)
    and (
      not p_featured_only
      or (p.featured and p.price > 0 and p.stock > 0)
    )
  order by (p_featured_only and p.featured) desc, p.sort_order, p.name
  limit case when p_featured_only then 4 else null end;
end;
$$;

create or replace function public.admin_list_products(
  p_branch_id uuid default null,
  p_product_id uuid default null
)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede consultar el inventario.'
      using errcode = '42501';
  end if;

  return query
  select p.*
  from public.products p
  where (p_branch_id is null or p.branch_id = p_branch_id)
    and (p_product_id is null or p.id = p_product_id)
  order by p.category, p.sort_order, p.name;
end;
$$;

create or replace function public.admin_low_stock_products(
  p_branch_id uuid default null
)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede consultar el inventario.'
      using errcode = '42501';
  end if;

  return query
  select p.*
  from public.products p
  where p.active
    and (p_branch_id is null or p.branch_id = p_branch_id)
  order by p.stock, p.name
  limit 5;
end;
$$;

create or replace function public.prevent_made_to_order_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null and exists (
    select 1
    from public.products p
    where p.id = new.product_id
      and p.made_to_order
  ) then
    raise exception 'Los productos por encargo se coordinan directamente con el administrador.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_reject_made_to_order on public.order_items;
create trigger order_items_reject_made_to_order
before insert or update of product_id on public.order_items
for each row execute function public.prevent_made_to_order_order_item();

revoke all on function public.catalog_products(uuid, text, boolean) from public;
revoke all on function public.admin_list_products(uuid, uuid) from public;
revoke all on function public.admin_low_stock_products(uuid) from public;
revoke all on function public.prevent_made_to_order_order_item() from public;
grant execute on function public.catalog_products(uuid, text, boolean) to authenticated;
grant execute on function public.admin_list_products(uuid, uuid) to authenticated;
grant execute on function public.admin_low_stock_products(uuid) to authenticated;

commit;
