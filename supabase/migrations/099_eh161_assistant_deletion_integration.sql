-- EH-161: explicitly purge assistant semantic artifacts at durable document deletion.

create or replace function public.eh161_purge_assistant_document_artifacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.assistant_reindex_jobs
  where document_id = old.id;
  delete from public.assistant_document_chunks
  where document_id = old.id;
  return old;
end;
$$;

drop trigger if exists eh161_purge_assistant_document_artifacts on public.documents;
create trigger eh161_purge_assistant_document_artifacts
before delete on public.documents
for each row
execute function public.eh161_purge_assistant_document_artifacts();

revoke all on function public.eh161_purge_assistant_document_artifacts() from public, anon, authenticated, service_role;
