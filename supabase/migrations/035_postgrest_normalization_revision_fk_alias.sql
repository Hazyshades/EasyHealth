-- PR 1 hotfix (OpenSpec change: fix-postgrest-normalization-revision-embeds)
--
-- Migration 034 dropped `observations_normalization_revision_fk` and created the
-- composite MATCH FULL `observations_normalization_revision_same_source_fk`.
-- Five deployed PostgREST readers (document observations, Biomarkers,
-- Health Profile, Reports, structured context) still embed with the old
-- relationship name, so environments with 034 applied fail relationship
-- resolution even though CI is green.
--
-- This migration adds the OLD NAME back as a temporary alias with the
-- IDENTICAL composite definition. Both explicit hints then resolve to the same
-- join while old and new application instances coexist.
--
-- Rollout matrix (authoritative copy in the OpenSpec change design):
--   * 034 already applied: apply this bridge -> reload PostgREST schema cache
--     -> prove an old-hint embedded read recovers -> deploy new-hint code
--     -> prove all five reads.
--   * 034 pending: pause affected API traffic -> apply 034 plus this bridge in
--     one controlled migration window -> reload cache -> prove an old-hint
--     embedded read -> resume traffic -> deploy new-hint code.
--
-- The alias is removed ONLY by a separate follow-up OpenSpec change after
-- complete instance/environment cutover evidence. This change must not ship an
-- executable alias-drop migration.

do $$
declare
  same_source_def text;
  alias_def text;
begin
  -- Preflight: the authoritative composite FK from migration 034 must exist.
  select pg_get_constraintdef(oid)
    into same_source_def
  from pg_constraint
  where conrelid = 'public.observations'::regclass
    and conname = 'observations_normalization_revision_same_source_fk';

  if same_source_def is null then
    raise exception using message =
      'postgrest_alias_preflight: observations_normalization_revision_same_source_fk is missing; apply migration 034 before the compatibility bridge';
  end if;

  -- Preflight: detect a divergent pre-existing constraint under the old name.
  select pg_get_constraintdef(oid)
    into alias_def
  from pg_constraint
  where conrelid = 'public.observations'::regclass
    and conname = 'observations_normalization_revision_fk';

  if alias_def is not null then
    if alias_def is distinct from same_source_def then
      raise exception using message = format(
        'postgrest_alias_preflight: observations_normalization_revision_fk already exists with divergent definition [%s]; expected [%s]. Resolve manually before applying the bridge.',
        alias_def,
        same_source_def
      );
    end if;
    -- Alias already present and identical: idempotent no-op.
    return;
  end if;

  execute $ddl$
    alter table public.observations
      add constraint observations_normalization_revision_fk
      foreign key (normalization_revision_id, source_extracted_biomarker_id)
      references public.observation_normalization_revisions (id, extracted_biomarker_id)
      match full
      on delete no action
      deferrable initially deferred
  $ddl$;

  -- Post-check: alias definition must be byte-identical to the authoritative FK.
  select pg_get_constraintdef(oid)
    into alias_def
  from pg_constraint
  where conrelid = 'public.observations'::regclass
    and conname = 'observations_normalization_revision_fk';

  if alias_def is distinct from same_source_def then
    raise exception using message = format(
      'postgrest_alias_postcheck: alias definition [%s] diverges from authoritative [%s]',
      alias_def,
      same_source_def
    );
  end if;
end;
$$;

comment on constraint observations_normalization_revision_fk on public.observations is
  'Temporary PostgREST compatibility alias for observations_normalization_revision_same_source_fk. Do not treat as authoritative. Removal requires the separate alias-drop follow-up change after complete instance/environment cutover evidence.';

-- Schema-cache reload is part of the deployment contract, not an optional smoke:
-- PostgREST must observe the new relationship before code cutover proceeds.
notify pgrst, 'reload schema';
