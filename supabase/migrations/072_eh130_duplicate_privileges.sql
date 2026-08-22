-- EH-130: RLS policies describe row visibility; explicit table privileges are
-- required by the service-role client used by authenticated server routes.

revoke all on table public.document_duplicate_candidates
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.document_duplicate_candidates
  to service_role;

revoke all on table public.document_duplicate_audit_events
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.document_duplicate_audit_events
  to service_role;
