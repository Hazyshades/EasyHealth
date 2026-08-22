-- EH-130: source-document deletion may detach an audit row's candidate
-- foreign key. That referential maintenance is not an editable audit event;
-- all event fields remain immutable and the historical row is retained.

create or replace function public.eh130_duplicate_audit_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.candidate_id is not null
    and new.candidate_id is null
    and old.id is not distinct from new.id
    and old.profile_id is not distinct from new.profile_id
    and old.left_document_id is not distinct from new.left_document_id
    and old.right_document_id is not distinct from new.right_document_id
    and old.archived_document_id is not distinct from new.archived_document_id
    and old.action is not distinct from new.action
    and old.match_kind is not distinct from new.match_kind
    and old.similarity_score is not distinct from new.similarity_score
    and old.actor_profile_id is not distinct from new.actor_profile_id
    and old.created_at is not distinct from new.created_at
  then
    return new;
  end if;

  raise exception using message = 'duplicate_audit_events_are_append_only';
end;
$$;
