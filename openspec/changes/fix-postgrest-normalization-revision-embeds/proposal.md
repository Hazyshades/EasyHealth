## Why

Migration `034_eh104_phase_b_enforcement.sql` replaces the PostgREST relationship name used by five active laboratory read paths, so environments with migration 034 applied can return relationship-resolution errors even though CI is green. This is a P0 deployment blocker, and the fix must also support environments where migration 034 has not yet been applied without exposing an incompatible schema/code interval.

## What Changes

- Add a temporary dual-constraint compatibility bridge so the old and new PostgREST relationship hints resolve during rolling code deployment.
- Update the five active read paths—document observations, Biomarkers, Health Profile, Reports, and structured context—to use `observations_normalization_revision_same_source_fk`.
- Define separate rollout procedures for environments where migration 034 is already applied and where it is still pending; neither procedure permits new code against the old-only schema or old code against the new-only schema.
- Require PostgREST schema-cache reload evidence after relationship changes.
- Add real migrated PostgREST/API integration coverage for every affected read path in both supported transition states, plus a static ban on the removed runtime hint after cutover.
- Retain the compatibility alias until every application instance and target environment runs the new hint; remove it in a later explicitly gated migration.

## Capabilities

### New Capabilities

- `postgrest-schema-compatibility`: Documents-domain contract for safely evolving named PostgREST relationships across independently deployed schema and application versions.

### Modified Capabilities

- None. The five APIs retain their existing response and eligibility semantics; this change restores the already-specified behavior.

## Impact

- **Domains:** documents, health-profile, reports.
- **Runtime:** five Supabase/PostgREST select strings.
- **Database:** a temporary compatibility constraint and later gated cleanup migration; no data rewrite.
- **Delivery:** this PR merges and deploys before EH-105 remediation or any production release. EH-109 and EH-110 may continue independently.
- **CI:** requires live PostgREST integration tests after migrations, not mocked query-builder tests.
