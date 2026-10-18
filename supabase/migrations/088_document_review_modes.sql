-- Persist the owner-selected laboratory review mode and protect its first-write boundary.

alter table public.profiles
  add column if not exists review_mode_default text not null default 'pro';

alter table public.profiles
  drop constraint if exists profiles_review_mode_default_check;

alter table public.profiles
  add constraint profiles_review_mode_default_check
  check (review_mode_default in ('easy', 'pro'));

alter table public.documents
  add column if not exists review_mode text,
  add column if not exists review_mode_locked_at timestamptz;

alter table public.documents
  drop constraint if exists documents_review_mode_check;

alter table public.documents
  add constraint documents_review_mode_check
  check (review_mode is null or review_mode in ('easy', 'pro'));

update public.documents
set review_mode = 'pro'
where document_type = 'lab_result'
  and review_mode is null;

update public.documents as document
set review_mode_locked_at = coalesce(
  (
    select min(revision.created_at)
    from public.document_extracted_biomarkers as extracted
    join public.observation_normalization_revisions as revision
      on revision.extracted_biomarker_id = extracted.id
    where extracted.document_id = document.id
      and revision.is_active
  ),
  (
    select min(extracted.created_at)
    from public.document_extracted_biomarkers as extracted
    where extracted.document_id = document.id
      and extracted.status in ('accepted', 'auto_accepted')
      and extracted.record_status = 'active'
      and extracted.is_current
      and extracted.is_published
  ),
  now()
)
where document.document_type = 'lab_result'
  and document.review_mode_locked_at is null
  and (
    exists (
      select 1
      from public.document_extracted_biomarkers as extracted
      join public.observation_normalization_revisions as revision
        on revision.extracted_biomarker_id = extracted.id
      where extracted.document_id = document.id
        and revision.is_active
    )
    or exists (
      select 1
      from public.document_extracted_biomarkers as extracted
      where extracted.document_id = document.id
        and extracted.status in ('accepted', 'auto_accepted')
        and extracted.record_status = 'active'
        and extracted.is_current
        and extracted.is_published
    )
  );

alter table public.observation_normalization_revisions
  add column if not exists review_mode_at_write text;

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_review_mode_check;

alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_review_mode_check
  check (review_mode_at_write is null or review_mode_at_write in ('easy', 'pro'));

comment on column public.profiles.review_mode_default is
  'Default laboratory Document review mode for future uploads.';

comment on column public.documents.review_mode is
  'Effective laboratory review mode. The upload snapshots the profile default; an owner may change it before the first accepted or corrected revision.';

comment on column public.documents.review_mode_locked_at is
  'Timestamp of the first accepted or manually corrected review write.';

comment on column public.observation_normalization_revisions.review_mode_at_write is
  'Owner review mode at the time of the normalization write. Null for historical or system-only revisions.';

create or replace function public.eh_snapshot_document_review_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_mode text;
begin
  if new.document_type = 'lab_result' and new.review_mode is null then
    select coalesce(review_mode_default, 'pro')
    into default_mode
    from public.profiles
    where id = new.profile_id;

    new.review_mode := case
      when default_mode = 'easy' then 'easy'
      else 'pro'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists eh_snapshot_document_review_mode
  on public.documents;

create trigger eh_snapshot_document_review_mode
before insert on public.documents
for each row
execute function public.eh_snapshot_document_review_mode();

create or replace function public.write_observation_normalization_revision_with_review_mode(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
  p_measurement_override jsonb default null,
  p_expected_active_revision_id uuid default null,
  p_mapping_change_classification text default 'additive',
  p_correction_reason text default null,
  p_reversal_of_revision_id uuid default null,
  p_supersedes_revision_id uuid default null,
  p_extraction_version text default null,
  p_reviewed_measurement_definition boolean default false,
  p_review_mode text default null
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  document public.documents;
  write_result record;
  target_document_id uuid;
  target_profile_id uuid;
begin
  if p_review_mode is not null
    and p_review_mode not in ('easy', 'pro') then
    raise exception using message = 'invalid_review_mode';
  end if;

  if p_review_mode is not null then
    target_document_id := nullif(p_observation ->> 'document_id', '')::uuid;
    target_profile_id := nullif(p_observation ->> 'profile_id', '')::uuid;

    select documents.*
    into document
    from public.documents
    where documents.id = target_document_id
      and documents.profile_id = target_profile_id
      and documents.document_type = 'lab_result'
    for update;

    if document.id is null then
      raise exception using message = 'review_mode_document_not_found';
    end if;

    if document.review_mode is distinct from p_review_mode then
      raise exception using message = 'review_mode_conflict';
    end if;

    if document.review_mode_locked_at is null then
      update public.documents
      set review_mode_locked_at = now()
      where id = document.id
        and review_mode_locked_at is null;
    end if;
  end if;

  select *
  into write_result
  from public.write_observation_normalization_revision_v2(
    p_extracted_biomarker_id,
    p_observation,
    p_resolution,
    p_write_kind,
    p_actor_id,
    p_request_hash,
    p_measurement_override,
    p_expected_active_revision_id,
    p_mapping_change_classification,
    p_correction_reason,
    p_reversal_of_revision_id,
    p_supersedes_revision_id,
    p_extraction_version,
    p_reviewed_measurement_definition
  );

  if p_review_mode is not null then
    update public.observation_normalization_revisions
    set review_mode_at_write = p_review_mode
    where id = write_result.revision_id
      and extracted_biomarker_id = p_extracted_biomarker_id;

    if not found then
      raise exception using message = 'review_mode_revision_not_found';
    end if;
  end if;

  return query
  select
    write_result.observation_id,
    write_result.revision_id,
    write_result.verification_status,
    write_result.resolver_result,
    write_result.was_reused;
end;
$$;

create or replace function public.restore_observation_normalization_revision_with_review_mode(
  p_extracted_biomarker_id uuid,
  p_target_revision_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid,
  p_correction_reason text,
  p_request_hash text,
  p_observation_payload jsonb,
  p_review_mode text
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  document public.documents;
  restore_result record;
begin
  if p_review_mode not in ('easy', 'pro') then
    raise exception using message = 'invalid_review_mode';
  end if;

  select documents.*
  into document
  from public.documents
  where documents.id = nullif(p_observation_payload ->> 'document_id', '')::uuid
    and documents.profile_id =
      nullif(p_observation_payload ->> 'profile_id', '')::uuid
    and documents.document_type = 'lab_result'
  for update;

  if document.id is null then
    raise exception using message = 'review_mode_document_not_found';
  end if;
  if document.review_mode is distinct from p_review_mode then
    raise exception using message = 'review_mode_conflict';
  end if;
  if document.review_mode_locked_at is null then
    update public.documents
    set review_mode_locked_at = now()
    where id = document.id
      and review_mode_locked_at is null;
  end if;

  select *
  into restore_result
  from public.restore_observation_normalization_revision_v1(
    p_extracted_biomarker_id,
    p_target_revision_id,
    p_expected_active_revision_id,
    p_actor_id,
    p_correction_reason,
    p_request_hash,
    p_observation_payload
  );

  update public.observation_normalization_revisions
  set review_mode_at_write = p_review_mode
  where id = restore_result.revision_id
    and extracted_biomarker_id = p_extracted_biomarker_id;

  if not found then
    raise exception using message = 'review_mode_revision_not_found';
  end if;

  return query
  select
    restore_result.observation_id,
    restore_result.revision_id,
    restore_result.verification_status,
    restore_result.resolver_result,
    restore_result.was_reused;
end;
$$;

revoke all on function public.restore_observation_normalization_revision_with_review_mode(
  uuid, uuid, uuid, uuid, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.restore_observation_normalization_revision_with_review_mode(
  uuid, uuid, uuid, uuid, text, text, jsonb, text
) to service_role;

create or replace function public.eh122_reverse_normalization_with_review_mode(
  p_batch_revision_id uuid,
  p_actor_id uuid,
  p_correction_reason text,
  p_request_hash text,
  p_review_mode text
)
returns table (
  observation_id uuid,
  revision_id uuid,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  document public.documents;
  reverse_result record;
begin
  if p_review_mode not in ('easy', 'pro') then
    raise exception using message = 'invalid_review_mode';
  end if;

  select documents.*
  into document
  from public.documents
  join public.document_extracted_biomarkers as extracted
    on extracted.document_id = documents.id
  join public.observation_normalization_revisions as revision
    on revision.extracted_biomarker_id = extracted.id
  where revision.id = p_batch_revision_id
    and documents.profile_id = p_actor_id
    and documents.document_type = 'lab_result'
  for update of documents;

  if document.id is null then
    raise exception using message = 'review_mode_document_not_found';
  end if;
  if document.review_mode is distinct from p_review_mode then
    raise exception using message = 'review_mode_conflict';
  end if;
  if document.review_mode_locked_at is null then
    update public.documents
    set review_mode_locked_at = now()
    where id = document.id
      and review_mode_locked_at is null;
  end if;

  select *
  into reverse_result
  from public.eh122_reverse_observation_normalization_verification(
    p_batch_revision_id,
    p_actor_id,
    p_correction_reason,
    p_request_hash
  );

  update public.observation_normalization_revisions
  set review_mode_at_write = p_review_mode
  where id = reverse_result.revision_id;

  return query
  select
    reverse_result.observation_id,
    reverse_result.revision_id,
    reverse_result.was_reused;
end;
$$;

revoke all on function public.eh122_reverse_normalization_with_review_mode(
  uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.eh122_reverse_normalization_with_review_mode(
  uuid, uuid, text, text, text
) to service_role;

revoke all on function public.write_observation_normalization_revision_with_review_mode(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean, text
) from public, anon, authenticated;

grant execute on function public.write_observation_normalization_revision_with_review_mode(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean, text
) to service_role;

notify pgrst, 'reload schema';
