-- EH-126: normalized medical-event identity and precision-safe chronology.
--
-- Medical dates are source facts, not upload metadata. Partial dates retain their
-- source precision; sort bounds are internal interval keys and are never exposed
-- as clinical dates.

create table if not exists public.medical_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'lab_result',
      'instrumental_report',
      'consultation_note',
      'discharge_summary',
      'prescription',
      'referral',
      'dicom',
      'other'
    )),
  created_at timestamptz not null default now(),
  constraint medical_events_source_document_unique unique (source_document_id)
);

create index if not exists medical_events_profile_created_idx
  on public.medical_events (profile_id, created_at desc, id);
create index if not exists medical_events_profile_type_idx
  on public.medical_events (profile_id, event_type, id);

create table if not exists public.medical_event_dates (
  id uuid primary key default gen_random_uuid(),
  medical_event_id uuid not null references public.medical_events(id) on delete cascade,
  date_role text not null
    check (date_role in ('occurred', 'occurred_end', 'collected', 'authored')),
  precision text not null
    check (precision in ('instant', 'day', 'month', 'year', 'unknown')),
  value_text text,
  raw_text text,
  timezone text,
  -- These fields are ordering implementation details. They are deliberately not
  -- returned by the timeline API as medical dates.
  sort_at timestamptz,
  sort_start_on date,
  sort_end_on date,
  created_at timestamptz not null default now(),
  constraint medical_event_dates_role_unique unique (medical_event_id, date_role)
);

create index if not exists medical_event_dates_event_role_idx
  on public.medical_event_dates (medical_event_id, date_role);
create index if not exists medical_event_dates_timeline_sort_idx
  on public.medical_event_dates (sort_start_on, sort_end_on, sort_at, medical_event_id);

comment on table public.medical_events is
  'EH-126 profile-scoped medical event boundary. One source document owns one event in this release.';
comment on table public.medical_event_dates is
  'EH-126 source date facts. value_text and precision are authoritative; sort bounds are internal ordering keys.';
comment on column public.medical_event_dates.precision is
  'Source precision: instant, day, month, year, or unknown. It is never inferred from upload time.';
comment on column public.medical_event_dates.timezone is
  'Explicit UTC/offset evidence for instant values only; calendar dates have no timezone.';

alter table public.medical_events enable row level security;
alter table public.medical_event_dates enable row level security;

drop policy if exists "service_all_medical_events" on public.medical_events;
create policy "service_all_medical_events"
  on public.medical_events for all to service_role using (true) with check (true);
drop policy if exists "service_all_medical_event_dates" on public.medical_event_dates;
create policy "service_all_medical_event_dates"
  on public.medical_event_dates for all to service_role using (true) with check (true);

grant select, insert, update, delete on table public.medical_events to service_role;
grant select, insert, update, delete on table public.medical_event_dates to service_role;

create or replace function public.eh126_event_type_for_document_type(p_document_type text)
returns text
language sql
immutable
as $$
  select case p_document_type
    when 'lab_result' then 'lab_result'
    when 'instrumental_report' then 'instrumental_report'
    when 'consultation_note' then 'consultation_note'
    when 'discharge_summary' then 'discharge_summary'
    when 'prescription' then 'prescription'
    when 'referral' then 'referral'
    when 'dicom' then 'dicom'
    else 'other'
  end;
$$;

grant execute on function public.eh126_event_type_for_document_type(text) to service_role;

create or replace function public.eh126_validate_medical_event_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_profile uuid;
begin
  select d.profile_id
  into v_document_profile
  from public.documents d
  where d.id = new.source_document_id;

  if v_document_profile is null then
    raise exception using message = 'medical_event_source_document_not_found';
  end if;
  if new.profile_id is distinct from v_document_profile then
    raise exception using message = 'medical_event_profile_document_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists medical_events_owner_guard on public.medical_events;
create trigger medical_events_owner_guard
  before insert or update on public.medical_events
  for each row execute function public.eh126_validate_medical_event_owner();

create or replace function public.eh126_validate_medical_event_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_month integer;
  v_day date;
  v_instant timestamptz;
begin
  if new.precision = 'unknown' then
    if new.value_text is not null
      or new.timezone is not null
      or new.sort_at is not null
      or new.sort_start_on is not null
      or new.sort_end_on is not null then
      raise exception using message = 'medical_event_unknown_date_has_value';
    end if;
    return new;
  end if;

  if new.precision in ('day', 'month', 'year') and new.timezone is not null then
    raise exception using message = 'medical_event_calendar_date_has_timezone';
  end if;

  if new.precision = 'day' then
    if new.value_text is null or new.value_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using message = 'medical_event_day_shape_invalid';
    end if;
    begin
      v_day := new.value_text::date;
    exception when others then
      raise exception using message = 'medical_event_day_invalid';
    end;
    new.sort_at := null;
    new.sort_start_on := v_day;
    new.sort_end_on := v_day;
  elsif new.precision = 'month' then
    if new.value_text is null or new.value_text !~ '^\d{4}-\d{2}$' then
      raise exception using message = 'medical_event_month_shape_invalid';
    end if;
    v_year := substring(new.value_text from 1 for 4)::integer;
    v_month := substring(new.value_text from 6 for 2)::integer;
    begin
      new.sort_start_on := make_date(v_year, v_month, 1);
    exception when others then
      raise exception using message = 'medical_event_month_invalid';
    end;
    new.sort_at := null;
    new.sort_end_on := (new.sort_start_on + interval '1 month - 1 day')::date;
  elsif new.precision = 'year' then
    if new.value_text is null or new.value_text !~ '^\d{4}$' then
      raise exception using message = 'medical_event_year_shape_invalid';
    end if;
    v_year := new.value_text::integer;
    begin
      new.sort_start_on := make_date(v_year, 1, 1);
    exception when others then
      raise exception using message = 'medical_event_year_invalid';
    end;
    new.sort_at := null;
    new.sort_end_on := make_date(v_year, 12, 31);
  elsif new.precision = 'instant' then
    if new.value_text is null
      or new.value_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$'
      or new.timezone is null then
      raise exception using message = 'medical_event_instant_timezone_required';
    end if;
    begin
      v_instant := new.value_text::timestamptz;
    exception when others then
      raise exception using message = 'medical_event_instant_invalid';
    end;
    new.sort_at := v_instant;
    new.sort_start_on := v_instant::date;
    new.sort_end_on := v_instant::date;
  else
    raise exception using message = 'medical_event_date_precision_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists medical_event_dates_contract_guard on public.medical_event_dates;
create trigger medical_event_dates_contract_guard
  before insert or update on public.medical_event_dates
  for each row execute function public.eh126_validate_medical_event_date();

create or replace function public.eh126_seed_medical_event_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.medical_event_dates (medical_event_id, date_role, precision)
  values
    (new.id, 'occurred', 'unknown'),
    (new.id, 'occurred_end', 'unknown'),
    (new.id, 'collected', 'unknown'),
    (new.id, 'authored', 'unknown')
  on conflict (medical_event_id, date_role) do nothing;
  return new;
end;
$$;

drop trigger if exists medical_events_seed_dates on public.medical_events;
create trigger medical_events_seed_dates
  after insert on public.medical_events
  for each row execute function public.eh126_seed_medical_event_dates();

create or replace function public.eh126_create_document_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.medical_events (profile_id, source_document_id, event_type)
  values (
    new.profile_id,
    new.id,
    public.eh126_event_type_for_document_type(new.document_type)
  )
  on conflict (source_document_id) do nothing;
  return new;
end;
$$;

drop trigger if exists documents_create_medical_event on public.documents;
create trigger documents_create_medical_event
  after insert on public.documents
  for each row execute function public.eh126_create_document_event();

create or replace function public.eh126_sync_document_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.medical_events
  set profile_id = new.profile_id,
      event_type = public.eh126_event_type_for_document_type(new.document_type)
  where source_document_id = new.id;
  return new;
end;
$$;

drop trigger if exists documents_sync_medical_event on public.documents;
create trigger documents_sync_medical_event
  after update of profile_id, document_type on public.documents
  for each row execute function public.eh126_sync_document_event();

-- Backfill is safe to rerun and creates unknown date roles through the event trigger.
insert into public.medical_events (profile_id, source_document_id, event_type)
select d.profile_id,
       d.id,
       public.eh126_event_type_for_document_type(d.document_type)
from public.documents d
on conflict (source_document_id) do nothing;
insert into public.medical_event_dates (
  medical_event_id,
  date_role,
  precision,
  value_text,
  raw_text
)
select e.id,
       'occurred',
       'day',
       d.observed_at::text,
       d.observed_at::text
from public.medical_events e
join public.documents d on d.id = e.source_document_id
where d.observed_at is not null
on conflict (medical_event_id, date_role) do update
set precision = excluded.precision,
    value_text = excluded.value_text,
    raw_text = excluded.raw_text;


alter table public.observations
  add column if not exists medical_event_id uuid references public.medical_events(id) on delete set null;
alter table public.observations
  alter column observed_at drop not null;

create index if not exists observations_medical_event_idx
  on public.observations (profile_id, medical_event_id, observed_at, id)
  where medical_event_id is not null;

create or replace function public.eh126_link_observation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.medical_events%rowtype;
begin
  if new.medical_event_id is not null then
    select * into v_event
    from public.medical_events
    where id = new.medical_event_id;
    if v_event.id is null then
      raise exception using message = 'medical_event_not_found';
    end if;
    if new.profile_id is distinct from v_event.profile_id
      or (new.document_id is not null and new.document_id is distinct from v_event.source_document_id) then
      raise exception using message = 'observation_medical_event_owner_mismatch';
    end if;
    return new;
  end if;

  if new.document_id is null then
    return new;
  end if;

  select * into v_event
  from public.medical_events
  where source_document_id = new.document_id;
  if v_event.id is null then
    return new;
  end if;
  if new.profile_id is distinct from v_event.profile_id then
    raise exception using message = 'observation_document_profile_mismatch';
  end if;
  new.medical_event_id := v_event.id;
  return new;
end;
$$;

drop trigger if exists observations_link_medical_event on public.observations;
create trigger observations_link_medical_event
  before insert or update of profile_id, document_id, medical_event_id on public.observations
  for each row execute function public.eh126_link_observation_event();

update public.observations o
set medical_event_id = e.id
from public.medical_events e
where o.medical_event_id is null
  and o.document_id = e.source_document_id
  and o.profile_id = e.profile_id;

-- PR2's source snapshot and measure day projections must allow an unknown study date.
alter table public.document_extracted_instrumental_measures
  alter column observed_at drop not null;
alter table public.document_instrumental_snapshot_contents
  alter column study_date drop not null;

-- The existing PR2 validator remains authoritative for all other fields. Patch
-- only its former "required date" branch so NULL means unknown while malformed
-- non-null dates are still rejected. This keeps the replacement migration small
-- and preserves every existing canonicalization/provenance check.
do $eh126_patch$
declare
  v_definition text;
  v_old text := 'if p_snapshot ->> ''study_date'' is null';
  v_new text := 'if p_snapshot ->> ''study_date'' is not null';
  v_date_or text := 'or (p_snapshot ->> ''study_date'') !~';
  v_date_and text := 'and (p_snapshot ->> ''study_date'') !~';
begin
  select pg_get_functiondef('public.pr2_validate_instrumental_snapshot(jsonb)'::regprocedure)
  into v_definition;
  if v_definition is null
    or (position(v_old in v_definition) = 0 and position(v_new in v_definition) = 0)
    or (position(v_date_or in v_definition) = 0 and position(v_date_and in v_definition) = 0) then
    raise exception using message = 'eh126_pr2_validator_patch_target_missing';
  end if;
  execute replace(
    replace(v_definition, v_old, v_new),
    v_date_or,
    v_date_and
  );
end;
$eh126_patch$;

-- EH-126: an explicit null correction clears a prior day projection without
-- turning the empty value into an invalid date string.
do $eh126_nullable_override_date$
declare
  v_definition text;
  v_old text := 'jsonb_typeof(p_override -> ''observed_at'') = ''string''';
  v_new text := '(p_override -> ''observed_at'') = ''null''::jsonb
        or jsonb_typeof(p_override -> ''observed_at'') = ''string''';
begin
  select pg_get_functiondef('public.eh119_is_measurement_override(jsonb)'::regprocedure)
  into v_definition;
  if v_definition is null
    or (position(v_old in v_definition) = 0 and position(v_new in v_definition) = 0) then
    raise exception using message = 'eh126_override_validator_patch_target_missing';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$eh126_nullable_override_date$;

create or replace function public.eh126_sync_document_event_dates(
  p_document_id uuid,
  p_dates jsonb
)
returns setof public.medical_event_dates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_event public.medical_events%rowtype;
  v_date jsonb;
  v_role text;
  v_precision text;
  v_has_occurred boolean := false;
  v_occurred_precision text;
  v_occurred_value text;
begin
  if jsonb_typeof(p_dates) is distinct from 'array' then
    raise exception using message = 'medical_event_dates_must_be_array';
  end if;

  select * into v_document
  from public.documents
  where id = p_document_id
  for update;
  if v_document.id is null then
    raise exception using message = 'medical_event_document_not_found';
  end if;

  select * into v_event
  from public.medical_events
  where source_document_id = p_document_id
  for update;
  if v_event.id is null then
    raise exception using message = 'medical_event_not_found';
  end if;
  if v_event.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'medical_event_profile_document_mismatch';
  end if;

  for v_date in select value from jsonb_array_elements(p_dates)
  loop
    if jsonb_typeof(v_date) is distinct from 'object' then
      raise exception using message = 'medical_event_date_item_invalid';
    end if;
    v_role := nullif(btrim(v_date ->> 'role'), '');
    v_precision := nullif(btrim(v_date ->> 'precision'), '');
    if v_role is null or v_role not in ('occurred', 'occurred_end', 'collected', 'authored') then
      raise exception using message = 'medical_event_date_role_invalid';
    end if;
    if v_precision is null or v_precision not in ('instant', 'day', 'month', 'year', 'unknown') then
      raise exception using message = 'medical_event_date_precision_invalid';
    end if;

    insert into public.medical_event_dates (
      medical_event_id,
      date_role,
      precision,
      value_text,
      raw_text,
      timezone
    )
    values (
      v_event.id,
      v_role,
      v_precision,
      nullif(v_date ->> 'value', ''),
      nullif(v_date ->> 'raw_text', ''),
      nullif(v_date ->> 'timezone', '')
    )
    on conflict (medical_event_id, date_role) do update
      set precision = excluded.precision,
          value_text = excluded.value_text,
          raw_text = excluded.raw_text,
          timezone = excluded.timezone;

    if v_role = 'occurred' then
      v_has_occurred := true;
      v_occurred_precision := v_precision;
      v_occurred_value := nullif(v_date ->> 'value', '');
    end if;
  end loop;

  if v_has_occurred then
    update public.documents
    set observed_at = case
      when v_occurred_precision = 'day' then v_occurred_value::date
      else null
    end
    where id = p_document_id;
  end if;

  return query
  select d.*
  from public.medical_event_dates d
  where d.medical_event_id = v_event.id
  order by d.date_role;
end;
$$;

revoke all on function public.eh126_sync_document_event_dates(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.eh126_sync_document_event_dates(uuid, jsonb)
  to service_role;

create or replace view public.medical_event_timeline as
select
  e.id as event_id,
  e.profile_id,
  e.event_type,
  e.source_document_id as document_id,
  e.created_at as event_created_at,
  d.original_filename,
  d.document_type,
  d.status as document_status,
  d.processing_status,
  d.lab_name,
  d.created_at as uploaded_at,
  occurred.precision as occurred_precision,
  occurred.value_text as occurred_value,
  occurred.raw_text as occurred_raw_text,
  occurred.timezone as occurred_timezone,
  occurred.sort_at as occurred_sort_at,
  occurred.sort_start_on as occurred_sort_start_on,
  occurred.sort_end_on as occurred_sort_end_on,
  case when occurred.precision = 'unknown' then 1 else 0 end as occurred_unknown_rank
from public.medical_events e
join public.medical_event_dates occurred
  on occurred.medical_event_id = e.id
 and occurred.date_role = 'occurred'
join public.documents d on d.id = e.source_document_id;

grant select on public.medical_event_timeline to service_role;

comment on view public.medical_event_timeline is
  'EH-126 profile-scoped timeline projection. occurred_sort_* are internal ordering bounds, not clinical dates.';
