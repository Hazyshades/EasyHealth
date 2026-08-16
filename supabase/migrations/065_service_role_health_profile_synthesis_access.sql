-- Health Profile reads current synthesis through the trusted service-role
-- client. RLS already allows service_role, but local Postgres no longer
-- default-grants table DML. Without SELECT the page API fails with
-- `permission denied for table profile_health_synthesis` after the RSC
-- payload has already been sent.
--
-- profile_health_synthesis_state already has SELECT/INSERT/UPDATE from the
-- EH-123 assessment migrations; the version table did not.

grant select, insert, update, delete on table public.profile_health_synthesis to service_role;
