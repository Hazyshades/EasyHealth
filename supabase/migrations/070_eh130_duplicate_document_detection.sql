-- EH-130: exact/near duplicate document candidates with explicit owner resolution.
-- Detection is non-destructive. Archive only marks a document; it never removes
-- the source object or derived evidence.

alter table public.documents
  add column if not exists content_sha256 text,
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_content_sha256_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_content_sha256_check
      check (
        content_sha256 is null
        or (
          content_sha256 = lower(content_sha256)
          and content_sha256 ~ '^[0-9a-f]{64}$'
        )
      );
  end if;
end;
$$;

create index if not exists documents_profile_content_sha256_idx
  on public.documents (profile_id, content_sha256)
  where content_sha256 is not null;

create index if not exists documents_profile_active_idx
  on public.documents (profile_id, archived_at, created_at desc);

create table if not exists public.document_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  left_document_id uuid not null,
  right_document_id uuid not null,
  match_kind text not null
    check (match_kind in ('exact', 'metadata')),
  similarity_score numeric(5, 4) not null
    check (similarity_score >= 0 and similarity_score <= 1),
  reason_codes text[] not null default '{}'::text[],
  state text not null default 'pending'
    check (state in ('pending', 'kept_both', 'archived_left', 'archived_right')),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint document_duplicate_candidates_pair_order_check
    check (left_document_id < right_document_id),
  constraint document_duplicate_candidates_pair_distinct_check
    check (left_document_id <> right_document_id),
  constraint document_duplicate_candidates_left_owner_fk
    foreign key (left_document_id, profile_id)
    references public.documents (id, profile_id)
    on delete cascade,
  constraint document_duplicate_candidates_right_owner_fk
    foreign key (right_document_id, profile_id)
    references public.documents (id, profile_id)
    on delete cascade,
  constraint document_duplicate_candidates_pair_unique
    unique (left_document_id, right_document_id)
);

create index if not exists document_duplicate_candidates_profile_state_idx
  on public.document_duplicate_candidates (profile_id, state, updated_at desc);

create index if not exists document_duplicate_candidates_left_idx
  on public.document_duplicate_candidates (left_document_id, state);

create index if not exists document_duplicate_candidates_right_idx
  on public.document_duplicate_candidates (right_document_id, state);

create table if not exists public.document_duplicate_audit_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.document_duplicate_candidates(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  left_document_id uuid,
  right_document_id uuid,
  archived_document_id uuid,
  action text not null
    check (action in ('detected', 'keep_both', 'archive_left', 'archive_right')),
  match_kind text
    check (match_kind is null or match_kind in ('exact', 'metadata')),
  similarity_score numeric(5, 4)
    check (similarity_score is null or (similarity_score >= 0 and similarity_score <= 1)),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_duplicate_audit_candidate_action_unique
    unique (candidate_id, action)
);

create index if not exists document_duplicate_audit_profile_created_idx
  on public.document_duplicate_audit_events (profile_id, created_at desc);

alter table public.document_duplicate_candidates enable row level security;
alter table public.document_duplicate_audit_events enable row level security;

drop policy if exists service_all_document_duplicate_candidates
  on public.document_duplicate_candidates;
create policy service_all_document_duplicate_candidates
  on public.document_duplicate_candidates
  for all to service_role
  using (true)
  with check (true);

drop policy if exists service_all_document_duplicate_audit_events
  on public.document_duplicate_audit_events;
create policy service_all_document_duplicate_audit_events
  on public.document_duplicate_audit_events
  for all to service_role
  using (true)
  with check (true);

create or replace function public.eh130_duplicate_audit_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using message = 'duplicate_audit_events_are_append_only';
end;
$$;

drop trigger if exists document_duplicate_audit_events_immutable
  on public.document_duplicate_audit_events;
create trigger document_duplicate_audit_events_immutable
  before update or delete on public.document_duplicate_audit_events
  for each row
  execute function public.eh130_duplicate_audit_immutable();

create or replace function public.eh130_normalize_filename(p_filename text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(p_filename, ''))), '\.[^./]+$', ''),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.eh130_metadata_similarity(
  p_left_filename text,
  p_right_filename text,
  p_left_file_size_bytes bigint,
  p_right_file_size_bytes bigint,
  p_left_mime_type text,
  p_right_mime_type text,
  p_left_document_type text,
  p_right_document_type text,
  p_left_observed_at date,
  p_right_observed_at date,
  p_left_lab_name text,
  p_right_lab_name text
)
returns table(score numeric, reason_codes text[])
language plpgsql
immutable
set search_path = public
as $$
declare
  v_score numeric := 0;
  v_reasons text[] := '{}'::text[];
  v_left_label text := regexp_replace(lower(trim(coalesce(p_left_lab_name, ''))), '\s+', ' ', 'g');
  v_right_label text := regexp_replace(lower(trim(coalesce(p_right_lab_name, ''))), '\s+', ' ', 'g');
begin
  if public.eh130_normalize_filename(p_left_filename) <> ''
     and public.eh130_normalize_filename(p_left_filename)
       = public.eh130_normalize_filename(p_right_filename) then
    v_score := v_score + 0.30;
    v_reasons := array_append(v_reasons, 'filename');
  end if;

  if p_left_file_size_bytes is not null
     and p_left_file_size_bytes = p_right_file_size_bytes then
    v_score := v_score + 0.25;
    v_reasons := array_append(v_reasons, 'file_size');
  end if;

  if nullif(lower(trim(coalesce(p_left_mime_type, ''))), '') is not null
     and lower(trim(p_left_mime_type)) = lower(trim(coalesce(p_right_mime_type, ''))) then
    v_score := v_score + 0.15;
    v_reasons := array_append(v_reasons, 'mime_type');
  end if;

  if nullif(lower(trim(coalesce(p_left_document_type, ''))), '') is not null
     and lower(trim(p_left_document_type)) = lower(trim(coalesce(p_right_document_type, ''))) then
    v_score := v_score + 0.15;
    v_reasons := array_append(v_reasons, 'document_type');
  end if;

  if p_left_observed_at is not null
     and p_left_observed_at = p_right_observed_at then
    v_score := v_score + 0.10;
    v_reasons := array_append(v_reasons, 'observed_at');
  end if;

  if v_left_label <> '' and v_left_label = v_right_label then
    v_score := v_score + 0.05;
    v_reasons := array_append(v_reasons, 'lab_name');
  end if;

  return query select round(v_score, 4), v_reasons;
end;
$$;

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

create or replace function public.eh130_documents_duplicate_detection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh130_detect_duplicate_documents(new.id);
  return new;
end;
$$;

drop trigger if exists documents_duplicate_detection_after_write
  on public.documents;
create trigger documents_duplicate_detection_after_write
after insert or update of content_sha256, original_filename, file_size_bytes,
  mime_type, document_type, observed_at, lab_name, archived_at
on public.documents
for each row
execute function public.eh130_documents_duplicate_detection_trigger();

create or replace function public.eh130_resolve_duplicate_candidate(
  p_candidate_id uuid,
  p_profile_id uuid,
  p_decision text
)
returns table(
  candidate_id uuid,
  state text,
  archived_document_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.document_duplicate_candidates%rowtype;
  v_left public.documents%rowtype;
  v_right public.documents%rowtype;
  v_state text;
  v_archived_document_id uuid;
begin
  if p_decision not in ('keep_both', 'archive_left', 'archive_right') then
    raise exception using message = 'invalid_duplicate_decision';
  end if;

  select * into v_candidate
  from public.document_duplicate_candidates
  where id = p_candidate_id
    and profile_id = p_profile_id
  for update;

  if not found then
    raise exception using message = 'duplicate_candidate_not_found';
  end if;

  select * into v_left
  from public.documents
  where id = v_candidate.left_document_id
    and profile_id = v_candidate.profile_id
  for update;

  if not found then
    raise exception using message = 'duplicate_candidate_left_document_missing';
  end if;

  select * into v_right
  from public.documents
  where id = v_candidate.right_document_id
    and profile_id = v_candidate.profile_id
  for update;

  if not found then
    raise exception using message = 'duplicate_candidate_right_document_missing';
  end if;

  if v_candidate.state <> 'pending' then
    if p_decision = 'keep_both' and v_candidate.state = 'kept_both' then
      return query select v_candidate.id, v_candidate.state, null::uuid;
      return;
    end if;
    if p_decision = 'archive_left' and v_candidate.state = 'archived_left' then
      return query select v_candidate.id, v_candidate.state, v_candidate.left_document_id;
      return;
    end if;
    if p_decision = 'archive_right' and v_candidate.state = 'archived_right' then
      return query select v_candidate.id, v_candidate.state, v_candidate.right_document_id;
      return;
    end if;
    raise exception using message = 'duplicate_candidate_already_resolved';
  end if;

  if p_decision = 'keep_both' then
    v_state := 'kept_both';
  elsif p_decision = 'archive_left' then
    v_state := 'archived_left';
    v_archived_document_id := v_left.id;
    update public.documents
    set archived_at = coalesce(archived_at, now()),
        archive_reason = coalesce(archive_reason, 'duplicate_document')
    where id = v_left.id
      and profile_id = v_candidate.profile_id;
  else
    v_state := 'archived_right';
    v_archived_document_id := v_right.id;
    update public.documents
    set archived_at = coalesce(archived_at, now()),
        archive_reason = coalesce(archive_reason, 'duplicate_document')
    where id = v_right.id
      and profile_id = v_candidate.profile_id;
  end if;

  update public.document_duplicate_candidates
  set state = v_state,
      updated_at = now(),
      reviewed_at = now(),
      reviewed_by = p_profile_id
  where id = v_candidate.id;

  insert into public.document_duplicate_audit_events (
    candidate_id,
    profile_id,
    left_document_id,
    right_document_id,
    archived_document_id,
    action,
    match_kind,
    similarity_score,
    actor_profile_id
  ) values (
    v_candidate.id,
    v_candidate.profile_id,
    v_candidate.left_document_id,
    v_candidate.right_document_id,
    v_archived_document_id,
    p_decision,
    v_candidate.match_kind,
    v_candidate.similarity_score,
    p_profile_id
  ) on conflict on constraint document_duplicate_audit_candidate_action_unique do nothing;

  return query select v_candidate.id, v_state, v_archived_document_id;
end;
$$;

revoke all on function public.eh130_normalize_filename(text)
  from public, anon, authenticated;
revoke all on function public.eh130_metadata_similarity(
  text, text, bigint, bigint, text, text, text, text, date, date, text, text
) from public, anon, authenticated;
revoke all on function public.eh130_detect_duplicate_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.eh130_documents_duplicate_detection_trigger()
  from public, anon, authenticated;
revoke all on function public.eh130_resolve_duplicate_candidate(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.eh130_resolve_duplicate_candidate(uuid, uuid, text)
  to service_role;
