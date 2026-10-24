-- Do not let documents being deleted block a new upload's reservation.
-- Duplicate candidates must reference live document rows because the EH-104
-- mutation guard rejects writes that touch deleting documents.

create or replace function public.eh130_detect_duplicate_documents(p_document_id uuid)
returns setof public.document_duplicate_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_other public.documents%rowtype;
  v_metadata record;
  v_candidate public.document_duplicate_candidates%rowtype;
  v_left_document_id uuid;
  v_right_document_id uuid;
  v_exact boolean;
  v_reasons text[];
begin
  select * into v_document
  from public.documents
  where id = p_document_id;

  if not found or v_document.archived_at is not null then
    return;
  end if;

  for v_other in
    select *
    from public.documents
    where profile_id = v_document.profile_id
      and id <> v_document.id
      and lifecycle_state = 'active'
      and archived_at is null
    order by id
  loop
    v_exact := v_document.content_sha256 is not null
      and v_other.content_sha256 is not null
      and v_document.content_sha256 = v_other.content_sha256;

    select * into v_metadata
    from public.eh130_metadata_similarity(
      v_document.original_filename,
      v_other.original_filename,
      v_document.file_size_bytes,
      v_other.file_size_bytes,
      v_document.mime_type,
      v_other.mime_type,
      v_document.document_type,
      v_other.document_type,
      v_document.observed_at,
      v_other.observed_at,
      v_document.lab_name,
      v_other.lab_name
    );

    if not v_exact and coalesce(v_metadata.score, 0) < 0.70 then
      continue;
    end if;

    if v_document.id < v_other.id then
      v_left_document_id := v_document.id;
      v_right_document_id := v_other.id;
    else
      v_left_document_id := v_other.id;
      v_right_document_id := v_document.id;
    end if;

    v_reasons := coalesce(v_metadata.reason_codes, '{}'::text[]);
    if v_exact then
      v_reasons := array_prepend('file_hash', v_reasons);
    end if;

    insert into public.document_duplicate_candidates (
      profile_id,
      left_document_id,
      right_document_id,
      match_kind,
      similarity_score,
      reason_codes,
      detected_at,
      updated_at
    ) values (
      v_document.profile_id,
      v_left_document_id,
      v_right_document_id,
      case when v_exact then 'exact' else 'metadata' end,
      case when v_exact then 1.0000 else coalesce(v_metadata.score, 0.0000) end,
      v_reasons,
      now(),
      now()
    )
    on conflict (left_document_id, right_document_id) do update
      set match_kind = excluded.match_kind,
          similarity_score = excluded.similarity_score,
          reason_codes = excluded.reason_codes,
          updated_at = now()
      where public.document_duplicate_candidates.state = 'pending'
    returning * into v_candidate;

    if not found then
      select * into v_candidate
      from public.document_duplicate_candidates
      where left_document_id = v_left_document_id
        and right_document_id = v_right_document_id;
    end if;

    insert into public.document_duplicate_audit_events (
      candidate_id,
      profile_id,
      left_document_id,
      right_document_id,
      action,
      match_kind,
      similarity_score
    ) values (
      v_candidate.id,
      v_candidate.profile_id,
      v_candidate.left_document_id,
      v_candidate.right_document_id,
      'detected',
      v_candidate.match_kind,
      v_candidate.similarity_score
    ) on conflict on constraint document_duplicate_audit_candidate_action_unique do nothing;

    return next v_candidate;
  end loop;

  return;
end;
$$;
