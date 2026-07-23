## Context

`observations` and `observation_normalization_revisions` have more than one relationship, so PostgREST embedding requires a named FK hint. Before migration 034, the observation-to-revision relationship is `observations_normalization_revision_fk`. Migration 034 drops it and creates the composite `observations_normalization_revision_same_source_fk`, but five deployed readers still use the old name.

Schema and application deployments are independent. Merely changing the five strings creates the inverse outage in environments that have not applied migration 034.

## Goals / Non-Goals

**Goals:**

- Restore all five read paths before any production deployment.
- Support both initial target states without a mixed schema/code outage.
- Preserve the composite `MATCH FULL` relationship as the authoritative join.
- Prove behavior through live PostgREST after schema-cache reload.

**Non-Goals:**

- Change response DTOs, laboratory eligibility, or revision projection policy.
- Make the obsolete single-column FK authoritative again.
- Keep duplicate constraints permanently.

## Decisions

### 1. Use a temporary dual-constraint bridge

After migration 034, add `observations_normalization_revision_fk` as a temporary alias with the same composite columns, target key, `MATCH FULL`, delete behavior, and deferrability as `observations_normalization_revision_same_source_fk`. Explicit old and new hints then resolve to the same join during code rollout.

Renaming the composite constraint back to the old name was rejected because it preserves the stale public relationship name and requires another breaking rename later. Removing the hint was rejected because the reverse `observation_id` relationship makes embedding ambiguous.

### 2. Deployment compatibility matrix

| Initial target state | Required order | Traffic rule |
| --- | --- | --- |
| Migration 034 already applied; new FK only | Apply alias bridge → reload cache → prove old reader recovers → deploy new-hint code → prove five reads | No new code before bridge; do not remove alias while an old instance exists |
| Migration 034 not applied; old FK only | Pause affected API traffic → apply 034 and alias bridge in one controlled migration window → reload cache → prove old reader still works → resume → deploy new-hint code | Do not expose the intermediate 034-only state to old application instances |

The cleanup migration that removes the alias is not applied until every target environment and application instance uses the new hint.

### 3. Treat schema-cache reload as part of deployment

Migration success alone is insufficient. Each relationship transition requires PostgREST schema-cache reload/observation followed by one real embedded read before proceeding.

### 4. Test every consumer against both transition states

The suite creates one owner, document, laboratory observation, extracted source, and active revision after the applicable migration state. It executes the actual Supabase/PostgREST select for each of the five consumers and asserts successful embedding and unchanged projection.

A static check rejects the old hint in active runtime code after code cutover but permits the temporary database alias and historical migrations.

## Risks / Trade-offs

- **[Temporary duplicate FK adds write-check overhead]** → Keep the interval short and use identical columns so no semantic divergence is possible.
- **[Traffic reaches the 034-only gap in a pending environment]** → Require an affected-API maintenance gate around 034 plus bridge application.
- **[Schema cache remains stale]** → Make live embedded-read evidence a rollout gate, not an optional smoke.
- **[Alias removed while old code still runs]** → Require an environment/instance inventory and separate cleanup deployment.
