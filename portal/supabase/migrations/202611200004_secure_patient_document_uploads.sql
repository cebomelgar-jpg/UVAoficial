-- Limit patient-document writes to the validated server action. The service
-- role performs writes only after the upload's MIME signature has been checked.

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

-- Uploads, replacement, and deletion are mediated by server actions. Without
-- these policies, authenticated clients cannot bypass the signature check.
drop policy if exists "patient_documents_storage_insert" on storage.objects;
drop policy if exists "patient_documents_storage_update" on storage.objects;
drop policy if exists "patient_documents_storage_delete" on storage.objects;
