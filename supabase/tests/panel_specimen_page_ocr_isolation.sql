begin;

select plan(4);

insert into public.profiles (id, email)
values ('11100000-0000-0000-0000-000000000001', 'psp-page-ocr@example.test');

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type,
  page_count, processing_status, write_generation
)
values (
  '11100000-0000-0000-0000-000000000010',
  '11100000-0000-0000-0000-000000000001',
  'psp-page-ocr/original.pdf',
  'PSP-multi-page.pdf',
  'processing',
  'lab_result',
  2,
  'processing',
  1
);

insert into public.document_pages (
  id, document_id, profile_id, page_number, width, height,
  preview_storage_path, ocr_text, processing_attempt_id, is_current
)
values
  (
    '11100000-0000-0000-0000-000000000021',
    '11100000-0000-0000-0000-000000000010',
    '11100000-0000-0000-0000-000000000001',
    1,
    612,
    792,
    'psp-page-ocr/page-1.webp',
    E'Complete blood count with manual smear microscopy + ESR\nHemoglobin (HGB) 138 g/L',
    null,
    true
  ),
  (
    '11100000-0000-0000-0000-000000000022',
    '11100000-0000-0000-0000-000000000010',
    '11100000-0000-0000-0000-000000000001',
    2,
    612,
    792,
    'psp-page-ocr/page-2.webp',
    E'Biochemistry and inflammation\nALT (GPT) 22 U/L',
    null,
    true
  );

select is(
  (
    select ocr_text from public.document_pages
    where id = '11100000-0000-0000-0000-000000000021'
  ),
  E'Complete blood count with manual smear microscopy + ESR\nHemoglobin (HGB) 138 g/L',
  'page 1 stores its own OCR including the CBC heading'
);

select is(
  (
    select ocr_text from public.document_pages
    where id = '11100000-0000-0000-0000-000000000022'
  ),
  E'Biochemistry and inflammation\nALT (GPT) 22 U/L',
  'page 2 stores its own OCR without the CBC heading'
);

select is(
  (
    select count(*)::int from public.document_pages
    where document_id = '11100000-0000-0000-0000-000000000010'
      and ocr_text like '%Complete blood count with manual smear microscopy + ESR%'
  ),
  1,
  'the CBC heading is persisted on exactly one page'
);

select is(
  (
    select page_number from public.document_pages
    where document_id = '11100000-0000-0000-0000-000000000010'
      and ocr_text like '%Complete blood count with manual smear microscopy + ESR%'
  ),
  1,
  'the CBC heading is not readable from the other page''s OCR'
);

select * from finish();
rollback;
