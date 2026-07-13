-- Private bucket for uploaded lab PDFs and images

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lab-documents',
  'lab-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
on conflict (id) do nothing;

-- Service role manages uploads from paid API routes
create policy "service_role_lab_documents_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'lab-documents')
  with check (bucket_id = 'lab-documents');
