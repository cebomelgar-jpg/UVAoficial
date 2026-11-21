-- Un Viaje Astral · Portal de pacientes
-- Oculta cantidades de stock, agrega productos derivados y la modalidad por encargo.

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

-- Patients can query catalog metadata but cannot read the exact inventory column.
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
