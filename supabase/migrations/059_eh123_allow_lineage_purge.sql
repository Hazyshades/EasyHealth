-- EH-123: audit rows remain immutable except during the established lineage purge.
create or replace function public.eh123_reject_append_only_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'update' then raise exception using message = 'eh123_append_only'; end if;
  if current_setting('easyhealth.purge_lineage', true) = 'on' then return old; end if;
  if not exists (select 1 from public.profiles where id = old.profile_id) then return old; end if;
  raise exception using message = 'eh123_append_only';
end;
$$;
notify pgrst, 'reload schema';