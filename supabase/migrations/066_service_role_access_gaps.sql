-- Repair explicit service-role privileges omitted by the original table migrations.
--
-- RLS policies do not grant table privileges. The worker logs AI calls directly
-- through PostgREST, and the document observations read embeds instrumental
-- source rows, so both relations need explicit service-role access.

revoke all on table public.ai_invocations from public, anon, authenticated;
grant select, insert on table public.ai_invocations to service_role;

revoke all on table public.document_extracted_instrumental_measures
  from public, anon, authenticated;
grant select on table public.document_extracted_instrumental_measures to service_role;
