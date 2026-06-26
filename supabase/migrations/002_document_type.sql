-- Add document_type for Documents hub tabs

alter table public.documents
  add column if not exists document_type text not null default 'lab'
    check (document_type in ('lab', 'imaging', 'consultation', 'dicom'));

create index if not exists documents_profile_type on public.documents (profile_id, document_type);
