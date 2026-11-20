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
