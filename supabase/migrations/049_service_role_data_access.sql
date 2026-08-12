-- Keep the trusted service-role API client usable for the document pipeline.
--
-- RLS policies decide which rows the service role may address, but policies do
-- not grant table privileges. These grants make the privileges explicit for
-- local and hosted migrations instead of relying on environment-specific
-- Supabase role bootstrap behavior.

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.documents to service_role;
grant select, insert, update, delete on table public.document_extracted_biomarkers to service_role;
grant select, insert, update, delete on table public.observations to service_role;
grant select, insert on table public.observation_normalization_revisions to service_role;
