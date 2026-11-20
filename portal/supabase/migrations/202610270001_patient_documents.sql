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
