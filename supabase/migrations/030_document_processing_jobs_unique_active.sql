-- Run as a standalone migration so PostgreSQL can build the index without
-- blocking writes to the processing queue.

create unique index concurrently if not exists document_processing_jobs_one_active_per_document
  on public.document_processing_jobs (document_id)
  where status in ('queued', 'processing');
