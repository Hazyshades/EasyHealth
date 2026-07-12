-- Reprocessing must preserve immutable lab extraction evidence and its
-- normalization revisions. A new extraction batch becomes current instead of
-- deleting the old rows (which would cascade-delete audit history).

alter table public.document_extracted_biomarkers
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz;

create index if not exists document_extracted_biomarkers_current_idx
  on public.document_extracted_biomarkers (document_id, is_current, created_at desc);
