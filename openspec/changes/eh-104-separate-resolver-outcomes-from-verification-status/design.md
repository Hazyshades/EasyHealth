# EH-104 Design: Resolver outcome and verification trust

## 1. Status ownership

The following is the post-cutover ownership model. Phase A establishes it for
the v2 promotion primitive and the document-observations projection. The
existing acceptance/correction writers remain on their legacy paths until
EH-106; Phase A deliberately does not reinterpret their extracted-row state.

```
document_extracted_biomarkers
  pre-acceptance extraction/review snapshot only
  resolver_result may be NULL before resolution
  verification_status is not authoritative for v2-promoted observations

                         accept / promote
                               |
                               v
observation_normalization_revisions
  active row is authoritative for v2-promoted observations
  resolver_result: resolved|partial|ambiguous|unmapped
  verification_status: pending|auto_verified|user_verified|manually_corrected
  verification decision metadata

                               |
                               v
observations
  normalization_revision_id, measurement_definition_key, resolution_status
  are atomically synchronized projections of the active revision
  no verification columns in EH-104
```

`rejected` is not in `verification_status`. Record rejection, lifecycle status,
and the related workflow are deferred to EH-120.

## 2. Resolver and verification matrix

```
resolver_result | pending | auto_verified | user_verified | manually_corrected
----------------+---------+---------------+---------------+-------------------
resolved        | yes     | yes           | yes           | yes
partial         | yes     | no            | no            | no
ambiguous       | yes     | no            | no            | no
unmapped        | yes     | no            | no            | no
```

`auto_verified`, `user_verified`, and `manually_corrected` require
`resolver_result = 'resolved'` and a non-null measurement definition. The
definition must be `reviewed`; that fact is owned by the code Registry and is
therefore checked only in a trusted service writer.

The runtime mapping is deferred to EH-106:

```
resolved + reviewed definition + user acceptance -> user_verified
partial | ambiguous | unmapped + raw acceptance -> pending
```

Raw acceptance is not verification of a concrete mapping.

## 3. Revision invariants

| ID | Invariant | Enforcement |
| --- | --- | --- |
| I1 | Revision `verification_status` is one of the four values and is non-null. | Phase A widens the existing check constraint and sets the default. |
| I2 | Resolver outcomes use the same four-value domain in revisions, observations, and extracted biomarkers. | Existing revision/observation checks; Phase A preflight reports legacy extracted values and Phase B adds its final storage constraint. A retired shadow table is inspected only when it still exists. |
| I3 | A verified revision is resolved and has a measurement definition. | Phase B INSERT/UPDATE guard; Phase A preflight reports violations. |
| I4 | The verified definition is `reviewed`. | Phase B trusted server-side Registry guard; Phase A preflight reports code-registry violations. |
| I5 | `pending` has null decision metadata. | Phase B INSERT/UPDATE guard; Phase A preflight reports violations. |
| I6 | `auto_verified` has `system`, null actor id, and a decision timestamp. | Phase B INSERT/UPDATE guard; Phase A preflight reports violations. |
| I7 | `user_verified` and `manually_corrected` have `user`, a non-null actor id, and a decision timestamp. | Phase B INSERT/UPDATE guard; Phase A preflight reports violations. |
| I8 | At most one revision is active per extracted biomarker. | Existing unique partial index. |
| I9 | An observation revision link and source-extraction link form a full same-source pair. | Composite relation where feasible, `MATCH FULL` or equivalent, and promotion checks. |
| I10 | The linked revision is active and its projection equals the observation projection. | Service-only promotion primitive and DB fixtures. |

`created_by` is revision-creation metadata. It does not satisfy a verification
actor invariant.

## 4. Source relationship

The Phase B normal form is:

```
observations(normalization_revision_id, source_extracted_biomarker_id)
  -> observation_normalization_revisions(id, extracted_biomarker_id)
```

Phase A adds `UNIQUE (id, extracted_biomarker_id)` on revisions so the composite
foreign key has a ready target. It does not add the composite foreign key or
`MATCH FULL`: the current EH-106-incompatible writers commit an observation
with a source extraction before an active revision exists. `NOT VALID` cannot
stage this relationship because it would still validate those new writes.

After EH-106 uses the atomic primitive, Phase B adds the composite relation and
rejects both partially-null forms: an observation with a source extraction but
no linked revision, and an observation with a linked revision but no source
extraction. Existing standalone observations are outside this relation only
when both values are null.

The active flag is mutable and cannot be enforced by a normal FK or CHECK.
Promotion therefore verifies that the linked revision is active and belongs to
the supplied observation/source/profile before committing the projection.

### Deletion and purge policy

Normalization revisions are append-only audit records in Phase B. Phase A does
not change deletion behavior because the existing document delete route relies
on the legacy `ON DELETE SET NULL` relationships. Ordinary runtime writers
MUST NOT delete revisions after Phase B is enabled. The only supported physical
deletion then is a controlled profile/document purge that preserves the current
behavior of retaining the observation while removing its document-derived
lineage.

Phase B replaces the standalone observation-to-revision FK with the full
composite relation and uses `MATCH FULL`. The controlled purge primitive locks
the affected lineage, deliberately clears both
`normalization_revision_id` and `source_extracted_biomarker_id` in the same
transaction, then deletes the extracted row/document so its revisions cascade.
It is the sole permitted bypass of the provenance write-once guard for this
pair. A direct revision delete is rejected or inaccessible to ordinary runtime
writers; it must not leave a half-linked observation.

## 5. Service-only CAS promotion primitive

Phase A adds `promote_observation_normalization_revision_v2`, a server-only
RPC alongside the legacy promotion RPC. Its contract accepts a target revision,
its target observation, the expected currently-active revision (nullable only
for first activation), and the authenticated service actor context. EH-106 is
the first runtime caller of v2; Phase A leaves the legacy RPC in place so the
existing correction path remains compatible.

For each invocation it MUST:

1. derive and lock the extracted biomarker row;
2. lock the target observation;
3. lock the active and target revisions in deterministic id order;
4. verify that revision, observation, extracted row, document, and profile
   belong to the same source lineage;
5. return a true no-op before CAS when the target is already active for the
   supplied observation and every source, ownership, and projection invariant
   holds; this return never rewrites promotion metadata and succeeds for a
   retry whose first-activation expectation was null;
6. compare the current active revision with `expected_active_revision_id` when
   the request was not a no-op;
7. deactivate the prior revision, activate the target revision, and synchronize
   `measurement_definition_key`, `normalization_revision_id`, and
   `resolution_status` in one transaction;
8. reject a divergent already-active projection rather than repairing it.

Any mismatch raises an exception and rolls back the promotion transaction. The
primitive does not create a batch operation, retry record, or public result
shape; those belong to EH-120. EH-106 owns the per-row integration with the
existing `ids[]` accept endpoint and Phase B removes the legacy RPC after that
cutover.

The lock order is mandatory for every writer that invokes this primitive:

```
extracted biomarker -> observation -> active/target revisions ordered by id
```

## 6. Authorization

Both promotion RPCs are server-only in Phase A. The migration MUST:

- retain a fixed `search_path` for every `SECURITY DEFINER` function;
- revoke execution from `PUBLIC`, `anon`, and `authenticated`;
- grant execution only to `service_role`;
- verify both denied and permitted calls in database fixtures.

RLS does not substitute for function grants on a `SECURITY DEFINER` RPC.

## 7. Rollout and populated databases

The rollout is deliberately staged:

```
Phase A: additive schema + read-only preflight + v2 primitive + service grants
        -> EH-106 writer cutover
        -> Phase B: preflight/backfill/reset decision
        -> Phase B: same-source, actor/cross-axis, purge enforcement + legacy removal
```

Before final constraints, preflight MUST report at least:

- null or unsupported verification/resolver values;
- verified revisions that are incomplete or lack a definition;
- rows with only one side of the observation/revision source relation;
- source/profile/document ownership mismatches;
- multiple active revisions and divergent observation projections.

Phase B uses this environment policy:

- persistent environments, including production and retained staging data,
  abort final enforcement with diagnostics and no data mutation for every
  preflight finding;
- a reset is permitted only for an explicitly marked disposable
  pre-production environment and deletes only document-derived observations,
  extracted biomarkers, and normalization revisions in one controlled purge
  workflow;
- EH-104 performs no automatic semantic repair or source-identity clearing.

The reset must require an explicit environment guard so that a retained
environment cannot be reset by mistake.

`NOT VALID` is not a Phase A staging mechanism: PostgreSQL would still enforce
the constraint for new writes. Phase A deliberately leaves every
EH-106-incompatible enforcement rule absent until the writer cutover.

## 8. Database fixture contract

EH-104 adds `supabase/config.toml`, pgTAP fixtures under
`supabase/tests/eh104_observation_resolution_verification.sql`, and the
package script `pnpm test:eh104-db` (`supabase test db --local`). CI starts a
disposable local Supabase stack, applies all migrations with `supabase db
reset`, then runs this command.

Phase A fixtures use a clean database and populated legacy fixtures. They
exercise safe domain additions, both RPC grants, v2 ownership, lock order,
CAS/no-op order, projection equality, and read-only preflight. Phase B fixtures
cover actor/cross-axis INSERT and UPDATE guards, the composite relation,
controlled purge, enforcement preflight abort, disposable reset, and direct
revision-delete denial.

## 9. Readers and downstream scope

`GET /api/documents/:id/observations` is the EH-104 observation projection
target. For an observation with an active linked revision, it projects that
revision's `resolver_result` and `verification_status`; it continues to expose
the synchronized `resolution_status` projection.

Health Profile is an aggregate consumer, not an observation DTO. EH-104 leaves
its scoring filter unchanged. EH-112 owns incomplete-outcome presentation,
trends, metrics, and consumer semantics.

## 10. Deferred handoffs

| Item | Handoff |
| --- | --- |
| EH-106 | Existing acceptance/correction writer cutover and per-row atomic integration. |
| EH-112 | Incomplete DTO behavior, UI wording, trends, assessment exclusion, and metrics. |
| EH-120 | Record rejection, lifecycle/workflow transitions, permissions, reasons, batch/idempotency/retry API, and auto-verification runtime activation. |
