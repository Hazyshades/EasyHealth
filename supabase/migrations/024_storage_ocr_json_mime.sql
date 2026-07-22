-- The worker stores structured per-page OCR artifacts as application/json.
-- Keep this allowlist aligned with src/lib/supabase/storage.ts and worker/src/pipeline.ts.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'text/plain',
  'application/json'
]
where id = 'lab-documents';
