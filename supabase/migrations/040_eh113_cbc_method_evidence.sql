-- EH-113 preserves explicit CBC differential method evidence for Registry 2.0 resolution.
alter table public.document_extracted_biomarkers
  add column if not exists method text;

alter table public.document_extracted_biomarkers
  drop constraint if exists document_extracted_biomarkers_method_check;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_method_check
  check (method is null or method in ('automated', 'manual'));

comment on column public.document_extracted_biomarkers.method is
  'Explicit laboratory method evidence used by Registry 2.0 resolution; automated | manual | null when unavailable.';
