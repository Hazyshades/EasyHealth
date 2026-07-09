-- Worker uploads page previews and thumbnails as WebP; OCR text as plain text.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'text/plain'
]
where id = 'lab-documents';
