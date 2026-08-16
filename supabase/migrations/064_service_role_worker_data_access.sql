-- Document worker DML for the trusted service-role client.
--
-- RLS policies already allow service_role on these tables, but policies do not
-- confer table privileges. 049 granted DML on profiles/documents/observations
-- and extracted biomarkers only. Local (and some hosted) Postgres images no
-- longer default-grant SELECT/INSERT/UPDATE/DELETE on public tables, so the
-- worker fails with `permission denied for table worker_heartbeats` and
-- `document_processing_jobs` before it can claim work.
--
-- Intentionally omitted: document_processing_attempts and instrumental
-- publication tables, which stay RPC-only after 036/037.

grant select, insert, update, delete on table public.worker_heartbeats to service_role;
grant select, insert, update, delete on table public.document_processing_jobs to service_role;
grant select, insert, update, delete on table public.document_pages to service_role;
grant select, insert, update, delete on table public.document_extracted_clinical_notes to service_role;
grant select, insert, update, delete on table public.document_extracted_prescriptions to service_role;
grant select, insert, update, delete on table public.document_extracted_referrals to service_role;
