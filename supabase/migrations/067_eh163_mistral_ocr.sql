-- EH-163: Mistral OCR provenance, attempt-scoped publication, and safe OCR telemetry.
--
-- New worker output is staged under a retained processing attempt. Current
-- readers continue to see the prior set until the attempt reaches completed.
-- The worker never writes document content to telemetry columns below.

-- ── 1. Attempt/publication metadata ──────────────────────────────────────────

alter table public.document_pages
  add column if not exists processing_attempt_id uuid,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz;

alter table public.document_pages
  drop constraint if exists document_pages_document_id_page_number_key,
  drop constraint if exists document_pages_processing_attempt_fk;

alter table public.document_pages
  add constraint document_pages_processing_attempt_fk
  foreign key (processing_attempt_id, profile_id, document_id)
  references public.document_processing_attempts (id, profile_id, document_id)
  on delete restrict;

create unique index if not exists document_pages_current_page_unique
  on public.document_pages (document_id, page_number)
  where is_current;

create index if not exists document_pages_attempt_idx
  on public.document_pages (document_id, processing_attempt_id, page_number);

alter table public.document_extracted_clinical_notes
  add column if not exists processing_attempt_id uuid,
  add column if not exists is_published boolean not null default true,
  add column if not exists unpublished_at timestamptz;

alter table public.document_extracted_prescriptions
  add column if not exists processing_attempt_id uuid,
  add column if not exists is_published boolean not null default true,
  add column if not exists unpublished_at timestamptz;

alter table public.document_extracted_referrals
  add column if not exists processing_attempt_id uuid,
  add column if not exists is_published boolean not null default true,
  add column if not exists unpublished_at timestamptz;

alter table public.document_extracted_clinical_notes
  drop constraint if exists document_extracted_clinical_notes_processing_attempt_fk;
alter table public.document_extracted_prescriptions
  drop constraint if exists document_extracted_prescriptions_processing_attempt_fk;
alter table public.document_extracted_referrals
  drop constraint if exists document_extracted_referrals_processing_attempt_fk;

alter table public.document_extracted_clinical_notes
  add constraint document_extracted_clinical_notes_processing_attempt_fk
  foreign key (processing_attempt_id, profile_id, document_id)
  references public.document_processing_attempts (id, profile_id, document_id)
  on delete restrict;
alter table public.document_extracted_prescriptions
  add constraint document_extracted_prescriptions_processing_attempt_fk
  foreign key (processing_attempt_id, profile_id, document_id)
  references public.document_processing_attempts (id, profile_id, document_id)
  on delete restrict;
alter table public.document_extracted_referrals
  add constraint document_extracted_referrals_processing_attempt_fk
  foreign key (processing_attempt_id, profile_id, document_id)
  references public.document_processing_attempts (id, profile_id, document_id)
  on delete restrict;

alter table public.document_extracted_clinical_notes
  drop constraint if exists document_extracted_clinical_notes_document_id_key;
alter table public.document_extracted_prescriptions
  drop constraint if exists document_extracted_prescriptions_document_id_key;
alter table public.document_extracted_referrals
  drop constraint if exists document_extracted_referrals_document_id_key;

create unique index if not exists document_extracted_clinical_notes_published_unique
  on public.document_extracted_clinical_notes (document_id)
  where is_published;
create unique index if not exists document_extracted_prescriptions_published_unique
  on public.document_extracted_prescriptions (document_id)
  where is_published;
create unique index if not exists document_extracted_referrals_published_unique
  on public.document_extracted_referrals (document_id)
  where is_published;

create index if not exists document_extracted_clinical_notes_attempt_idx
  on public.document_extracted_clinical_notes (document_id, processing_attempt_id);
create index if not exists document_extracted_prescriptions_attempt_idx
  on public.document_extracted_prescriptions (document_id, processing_attempt_id);
create index if not exists document_extracted_referrals_attempt_idx
  on public.document_extracted_referrals (document_id, processing_attempt_id);

alter table public.document_extracted_biomarkers
  add column if not exists is_published boolean not null default true,
  add column if not exists published_at timestamptz,
  add column if not exists source_text_origin text,
  add column if not exists ocr_provider text,
  add column if not exists ocr_model text,
  add column if not exists ocr_adapter_version text,
  add column if not exists ocr_artifact_schema_version integer,
  add column if not exists ocr_source_sha256 text;

alter table public.document_extracted_biomarkers
  drop constraint if exists document_extracted_biomarkers_source_text_origin_check,
  drop constraint if exists document_extracted_biomarkers_ocr_provider_check,
  drop constraint if exists document_extracted_biomarkers_ocr_source_sha256_check;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_source_text_origin_check
  check (source_text_origin is null or source_text_origin in ('pdf_text_layer', 'mistral_ocr', 'vision_model')),
  add constraint document_extracted_biomarkers_ocr_provider_check
  check (ocr_provider is null or ocr_provider in ('poppler', 'mistral')),
  add constraint document_extracted_biomarkers_ocr_source_sha256_check
  check (ocr_source_sha256 is null or ocr_source_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists document_extracted_biomarkers_publication_idx
  on public.document_extracted_biomarkers (document_id, is_published, created_at desc);

comment on column public.document_extracted_biomarkers.is_published is
  'EH-163 visibility boundary. Staged attempt rows remain false until the attempt completes.';
comment on column public.document_extracted_biomarkers.source_text_origin is
  'EH-163 transcription origin: native PDF text, Mistral OCR, or legacy vision model.';
comment on column public.document_extracted_biomarkers.ocr_source_sha256 is
  'SHA-256 of the private source object used by the OCR adapter; never source content.';

-- ── 2. Privacy-safe OCR invocation telemetry ──────────────────────────────────

alter table public.ai_invocations
  add column if not exists region text,
  add column if not exists input_bytes bigint,
  add column if not exists pages_processed integer,
  add column if not exists request_id text,
  add column if not exists estimated_cost_usd numeric,
  add column if not exists processing_attempt_id uuid;

alter table public.ai_invocations
  drop constraint if exists ai_invocations_processing_attempt_fk,
  drop constraint if exists ai_invocations_ocr_safe_fields_check;

alter table public.ai_invocations
  add constraint ai_invocations_processing_attempt_fk
  foreign key (processing_attempt_id)
  references public.document_processing_attempts(id)
  on delete set null,
  add constraint ai_invocations_ocr_safe_fields_check
  check (
    stage <> 'ocr'
    or (
      provider = 'mistral'
      and input_bytes is not null
      and input_bytes >= 0
      and pages_processed is not null
      and pages_processed >= 0
      and (
        error_code is null or error_code in (
          'ocr_provider_unavailable', 'ocr_timeout', 'ocr_invalid_response',
          'ocr_input_rejected', 'ocr_page_mismatch'
        )
      )
    )
  );

-- ── 3. Completion/failure publication seam ───────────────────────────────────

create or replace function public.eh163_publish_document_processing_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  document_row public.documents%rowtype;
  staged_pages integer;
  expected_pages integer;
begin
  if old.state is distinct from 'active' then
    return new;
  end if;

  select * into document_row
  from public.documents
  where id = new.document_id
  for update;

  if new.state = 'completed' then
    select count(*)::integer
    into staged_pages
    from public.document_pages
    where document_id = new.document_id
      and processing_attempt_id = new.id;

    -- Legacy/non-worker completion calls can have no staged pages. A real
    -- EH-163 worker attempt always stages a complete page set, and a partial
    -- set is rejected rather than promoted.
    if staged_pages > 0 then
      expected_pages := document_row.page_count;
      if expected_pages is null or staged_pages <> expected_pages then
        raise exception using message = 'eh163_page_set_incomplete';
      end if;
      if exists (
        select 1
        from public.document_pages staged
        where staged.document_id = new.document_id
          and staged.processing_attempt_id = new.id
          and (
            staged.page_number < 1
            or staged.page_number > expected_pages
          )
      ) or (
        select count(distinct staged.page_number)
        from public.document_pages staged
        where staged.document_id = new.document_id
          and staged.processing_attempt_id = new.id
      ) <> expected_pages then
        raise exception using message = 'eh163_page_set_invalid';
      end if;

      update public.document_pages
      set is_current = false,
          superseded_at = coalesce(superseded_at, now())
      where document_id = new.document_id
        and is_current
        and processing_attempt_id is distinct from new.id;

      update public.document_pages
      set is_current = true,
          superseded_at = null
      where document_id = new.document_id
        and processing_attempt_id = new.id;
    end if;

    update public.document_extracted_clinical_notes
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and is_published
      and processing_attempt_id is distinct from new.id;
    update public.document_extracted_clinical_notes
    set is_published = true,
        unpublished_at = null
    where document_id = new.document_id
      and processing_attempt_id = new.id;

    update public.document_extracted_prescriptions
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and is_published
      and processing_attempt_id is distinct from new.id;
    update public.document_extracted_prescriptions
    set is_published = true,
        unpublished_at = null
    where document_id = new.document_id
      and processing_attempt_id = new.id;

    update public.document_extracted_referrals
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and is_published
      and processing_attempt_id is distinct from new.id;
    update public.document_extracted_referrals
    set is_published = true,
        unpublished_at = null
    where document_id = new.document_id
      and processing_attempt_id = new.id;

    perform set_config('easyhealth.lifecycle_transition', 'on', true);
    if document_row.document_type <> 'lab_result' then
      update public.document_extracted_biomarkers
      set is_published = false,
          published_at = coalesce(published_at, now())
      where document_id = new.document_id
        and is_published
        and record_status = 'active';
    end if;

    update public.document_extracted_biomarkers
    set is_published = true,
        published_at = coalesce(published_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id
      and record_status = 'active';
  elsif new.state in ('failed', 'requeued', 'reclaimed') then
    update public.document_pages
    set is_current = false,
        superseded_at = coalesce(superseded_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id
      and not is_current;

    update public.document_extracted_clinical_notes
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id;
    update public.document_extracted_prescriptions
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id;
    update public.document_extracted_referrals
    set is_published = false,
        unpublished_at = coalesce(unpublished_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id;

    perform set_config('easyhealth.lifecycle_transition', 'on', true);
    update public.document_extracted_biomarkers
    set is_published = false,
        published_at = coalesce(published_at, now())
    where document_id = new.document_id
      and processing_attempt_id = new.id
      and record_status = 'active';
  end if;

  return new;
end;
$$;

revoke all on function public.eh163_publish_document_processing_attempt()
  from public, anon, authenticated;
grant execute on function public.eh163_publish_document_processing_attempt()
  to service_role;

drop trigger if exists eh163_publish_document_processing_attempt
  on public.document_processing_attempts;
create trigger eh163_publish_document_processing_attempt
after update of state on public.document_processing_attempts
for each row execute function public.eh163_publish_document_processing_attempt();

comment on function public.eh163_publish_document_processing_attempt() is
  'EH-163 publishes staged pages and typed evidence only with successful attempt completion; failed attempts retain the prior current set.';

-- ── 4. Worker-only access for new metadata ────────────────────────────────────

revoke all on table public.document_pages from public, anon, authenticated;
grant select, insert, update, delete on table public.document_pages to service_role;
revoke all on table public.document_extracted_clinical_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.document_extracted_clinical_notes to service_role;
revoke all on table public.document_extracted_prescriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.document_extracted_prescriptions to service_role;
revoke all on table public.document_extracted_referrals from public, anon, authenticated;
grant select, insert, update, delete on table public.document_extracted_referrals to service_role;
revoke all on table public.document_extracted_biomarkers from public, anon, authenticated;
grant select, insert, update, delete on table public.document_extracted_biomarkers to service_role;
revoke all on table public.ai_invocations from public, anon, authenticated;
grant select, insert on table public.ai_invocations to service_role;

notify pgrst, 'reload schema';
