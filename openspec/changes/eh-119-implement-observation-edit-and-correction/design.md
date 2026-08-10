# Design: implement observation edit and correction flow

## Context

The review workspace (EH-117) renders rows, the provenance link (EH-118) grounds
them in the page, and the writer seam (EH-106/EH-115) records every decision as
an append-only revision promoted under a compare-and-swap. What is missing is
the ability to change anything a human can see is wrong.

Three facts constrain the shape of the answer.

**The projection is four columns wide.**
`promote_observation_normalization_revision_v2` writes `analyte_key`,
`measurement_definition_key`, `normalization_revision_id` and
`resolution_status` onto the observation and nothing else. The observation row
itself is created once, by
`insert ... on conflict (source_extracted_biomarker_id) ... do nothing`. Every
measurement field in `p_observation` — value, unit, reference bounds,
`observed_at` — is therefore honoured on the first write for a row and silently
discarded on every write after it.

**Raw is already protected, and value is already not.** The
`observation_provenance_write_once` trigger defends `raw_name`,
`raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`,
`source_text`, `bounding_box`, `confidence`, `source_extracted_biomarker_id`
and every version column. It deliberately does not cover `value`, `value_text`,
`value_kind`, `ordinal`, `unit`, `ref_low`, `ref_high` or `observed_at`. The
acceptance criterion "corrections never overwrite raw fields" is thus already a
database invariant; this change must extend the writable set without going near
the protected one.

**Correction currently means "pick a definition".**
`correction_requires_reviewed_concrete_definition` refuses any correction whose
outcome is not `resolved`, and `buildManualCorrectionResolution` hard-sets
`result: "resolved"` and rejects any candidate with a missing axis. Meanwhile
`compatibleManualDefinitions` correctly offers nothing when the document states
no specimen. After #106 removed inferred specimens and before #111 recovers them
from a reviewed panel policy, the reference document is 44 partial rows and 0
resolved, so the only correction the product supports is the one that cannot be
made.

One further fact shapes expectations rather than architecture:
`baseExclusion` in `incomplete-laboratory-outcomes.ts` excludes every
non-`resolved` observation from trends, reports, structured context, conversion
and assessment. Correcting the value of a partial row therefore changes the
review surface and the stored record, and changes nothing a consumer reads until
that row becomes resolved. That is the correct behaviour, not a defect, but it
means EH-119's near-term user-visible value is record correctness and #111
readiness rather than immediate downstream effect.

## Goals / Non-Goals

**Goals:**

- A reviewer can restate the value, unit, reference range and observation date
  of an extracted laboratory result, with a reason, and keep the result partial
  or unmapped.
- Every correction is append-only, attributable, idempotent on replay,
  concurrency-safe under the existing CAS, and reversible.
- Identity remains derived from evidence: a correction changes the resolver's
  input and never asserts its output.
- Raw extraction stays byte-identical, proven by the existing write-once
  trigger rather than by convention.
- Invalid units and ranges are refused before they reach the database, with an
  error that names the field and appears on the row that produced it.
- A corrected row is not silently re-resolved away by reprocessing.

**Non-Goals:**

- Verification transitions, rejection, supersession, batch verification and the
  workflow state machine. Those are EH-120. This change derives verification
  status from the existing rules and adds no status value.
- A change-history endpoint or history UI. That is EH-121; this change only
  guarantees the history exists and is readable.
- Recovering panel specimens so that rows become resolvable. That is #111, and
  a specimen dropdown is an explicit anti-goal here.
- A comparator or censored-value model. That is #108; this change only refuses
  to make the problem worse by synthesising numbers from comparators.
- Editing raw extraction, editing clinical identity axes, editing instrumental
  observations, or carrying a correction across a document reprocess into the
  newly extracted rows.
- Any resolver behaviour change. `MEASUREMENT_RESOLVER_VERSION` does not move,
  the catalog manifest digest does not move, and the candidate-release
  approvals do not need re-signing.

## Decisions

### 1. A correction edits the resolver's input, not the stored result

The reviewer restates evidence. The system re-runs `resolveMeasurementDefinition`
on raw evidence with that restatement applied and persists whatever the resolver
concludes.

```
   document_extracted_biomarkers            request
   (raw, immutable)                         measurement_override
            │                                      │
            └──────────────┬───────────────────────┘
                           ▼
                 effective resolver input
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      resolveMeasurementDefinition   effective measurement
              │                         │
              ▼                         ▼
        resolution + trace         p_observation
              │                         │
              └────────────┬────────────┘
                           ▼
        write_observation_normalization_revision_v2
                           │
                           ▼
        promote_observation_normalization_revision_v2
                    (CAS + projection)
                           ▼
                      observations
```

Alternatives rejected:

- *Persist a corrected outcome directly.* Lets a reviewer assert an identity the
  evidence does not support, and reintroduces exactly the class of defect #120
  and #106 were about — an identity that did not come from surviving evidence.
- *Correct the observation row and leave the revision alone.* Breaks the
  invariant that the active revision explains the observation, and makes the
  correction invisible to the audit trail EH-121 will read.

Consequences that fall out for free: `buildInputEvidenceHash` already covers
`rawUnit`, `rawValueText`, `valueKind`, `referenceLow` and `referenceHigh`, so a
corrected input naturally produces a distinct revision identity; the EH-115
trace validator already accepts `decisionKind = 'manual_selection'` and the
resolver's own outcomes; and `unit_dimension_conflict` is already the hard
evidence code that must block an impossible unit.

### 2. The override is one validated `jsonb` column on the revision

`observation_normalization_revisions.measurement_override jsonb`, with an
`IMMUTABLE` shape function `eh119_is_measurement_override(jsonb)` and a CHECK,
following `eh115_validate_resolver_decision_trace` and `eh118_is_source_region`.
Keys are drawn from exactly `value`, `value_text`, `value_kind`, `ordinal`,
`unit`, `ref_low`, `ref_high`, `observed_at`; at least one key must be present;
no other key is allowed; `ref_low <= ref_high` when both are present.

Key *presence* carries meaning — it is what distinguishes "the reviewer cleared
the unit" from "the reviewer did not touch the unit". A column-per-field design
cannot express that without a parallel "which fields were edited" list.

Alternatives rejected:

- *Typed `corrected_*` columns.* Eight nullable columns, a ninth to record
  intent, and no cheaper validation than the function above.
- *A separate `observation_measurement_corrections` table.* A second append-only
  log beside `observation_normalization_revisions`, with its own activation,
  ordering and CAS story to keep consistent with the first one.
- *Overriding the extracted row.* Would put user data in the extraction record
  and destroy the meaning of `is_current` supersession.

The key-name allowlist is also what enforces "an override naming a raw field is
refused" at the database level, independently of the API.

### 3. The override is absolute against raw extraction, never cumulative

Each revision carries the complete restatement relative to the raw extracted
row. Undo becomes a copy of a previous revision's override rather than a replay
of a diff chain, and reading the effective measurement never requires walking
history. The cost is that a reviewer changing only the unit on an
already-corrected row submits both fields; the API composes that from the
active override so the UI form is still prefilled.

### 4. `p_observation` always carries the effective measurement

The application writer composes `p_observation` from raw evidence plus the
effective override — the request's override for a correction, the active
revision's override for every other write kind — and the promotion primitive
projects those measurement columns onto the observation unconditionally.

This is the invariant that keeps a correction from being quietly reverted: an
acceptance, a confirmation or a reprocessing write that runs after a correction
re-emits the corrected measurement rather than the raw one. The alternative —
projecting measurement columns only for the correction write kind — leaves every
other write path as a latent path back to the extracted value.

The promotion primitive's idempotent short-circuit must therefore compare the
measurement columns as well as the identity columns; otherwise a correction that
changes only a value would be mistaken for a completed write and skipped.

### 5. A third write kind, and not one relaxed guard

`p_write_kind` gains `value_correction`.
`correction_requires_reviewed_concrete_definition` stays exactly as it is and
keeps applying to `correction`. The EH-104 verification trigger stays exactly as
it is.

Verification status is derived, not chosen:

| write kind | re-resolution | verification status |
| --- | --- | --- |
| `acceptance` | `resolved` + reviewed | `user_verified` |
| `acceptance` | incomplete | `pending` |
| `correction` | `resolved` + reviewed | `manually_corrected` |
| `correction` | incomplete | rejected, unchanged |
| `value_correction` | `resolved` + reviewed | `manually_corrected` |
| `value_correction` | incomplete | `pending` |

This is the only derivation that satisfies
`eh104_validate_normalization_revision_verification`, which requires
`resolver_result = 'resolved'` and a non-null definition key for any status
other than `pending`, and forbids decision metadata on `pending`. Relaxing that
trigger to admit a "corrected but incomplete" verified status would be inventing
a workflow state, which belongs to EH-120.

Rejected alternative: *widen `correction`.* It collides with the EH-104 trigger
immediately, and it would silently change the meaning of every stored
`manually_corrected` revision.

### 6. "A human restated this" is derived, not a new status column

The review surface needs to say a person edited the row even when verification
is `pending`. That signal is `measurement_override is not null` on the active
revision — no new column, no new enum value, and no dependency on EH-120's
status machine. `VERIFICATION_LABELS` keeps meaning verification only.

### 7. Reason, actor and time reuse the columns that already exist

`correction_reason`, `created_by` and `created_at` are on the revision and are
not touched by the `pending` decision-metadata guard, which only constrains
`verification_decided_at`, `verification_actor_type` and
`verification_actor_id`. The reason becomes required and non-blank for both
correcting write kinds, and joins `buildNormalizationWriterRequestHash` together
with the override so that two different corrections cannot collide on one
idempotency key and an identical replay still reuses one revision.

### 8. Undo is a forward `value_correction` that restores a prior override

Undo writes a new revision whose override and selected definition are copied
from the target revision, with `reversal_of_revision_id` set and the usual CAS.
The current rejection of a target revision without a
`measurement_definition_key` is removed: that case is precisely the partial and
unmapped history this change creates. Undoing back to a revision with a null
override restores the raw extracted measurement.

### 9. Validation runs in the application, with the database as the backstop

`evaluateUnitCompatibility(definition.unitPolicy, normalizeMeasurementUnit(unit))`
is the authority for a restated unit; the shape rules are the authority for the
range, the date and value/value-kind coherence. Rejections carry a stable code
so the route can choose `400`, `409` or `422` without string-matching, and so
the UI can render a message on the offending field.

A unit whose dimension conflicts with the definition currently bound to the row
would degrade a resolved row to incomplete. That is a real, sometimes correct
outcome, so it is not forbidden — it is refused unless the request explicitly
acknowledges the loss of the binding. Silent degradation is the one behaviour
ruled out.

`ObservationNormalizationWriterError` gains a `code`; the route's hand-written
409 message allowlist is replaced by code mapping. `RegistryReprocessError`
already carries a code and is the precedent.

### 10. A corrected row is a protected manual decision

`selection.ts` and `diff.ts` in `registry-reprocessing` currently protect
`user_verified` and `manually_corrected` active revisions. An active revision
carrying an override joins that set. The user's edit survives a batch by
default; `--include-manual-decisions` with a reason remains the explicit escape
hatch, and because of decision 4 the override is carried forward even when the
identity is re-resolved.

Note `decideAutomaticPromotion` is reachable only from
`verify-measurement-registry-runner.ts`; the runtime protection is EH-116's
selection filter, so that is the code that must change.

## Risks / Trade-offs

- **Widening the promotion projection touches every write path.** → The
  projection and its short-circuit are the most load-bearing code in the writer.
  Cover the unchanged paths first: extend `eh106_atomic_observation_normalization_writer.sql`
  and `writer_rpc_seam.sql` with assertions that an acceptance replay is still
  an idempotent no-op and that a re-acceptance does not alter an unrelated
  column, and mutation-check each new assertion against the pre-047 function.
- **A correction is invisible to consumers while the row is partial.** →
  `baseExclusion` excludes every non-resolved outcome from trends, reports,
  context, conversion and assessment. State this in the QA checklist as expected
  behaviour so a tester does not log it as a defect, and make the review row
  say what the correction did and did not change.
- **The reviewed-definition picker is empty for the current population.** →
  #111 is the lever, not this change. EH-119 must remain useful with an empty
  picker; that is why value editing and raw acceptance carry the item.
- **`pnpm test:eh111` is red on this branch** at
  `verify-eh111-clinical-compatibility.ts:184`, asserting
  `unit_dimension_conflict` for `Neutrophils absolute` in `%`, which currently
  resolves to `unmapped` with zero candidates because the alias never matches.
  → That assertion guards the exact primitive decision 9 depends on. Establish
  whether the alias gap is in scope before relying on the suite; do not add
  EH-119 assertions to a file that cannot go green.
- **The identity-gate delta is archived.** The completed
  `fix-analyte-key-identity-gate` change is now under
  `openspec/changes/archive/2026-08-09-fix-analyte-key-identity-gate/`; its
  `registry-v2-acceptance-correction` requirement is the base this change
  extends. The EH-119 delta keeps the two identity tiers and adds measurement
  correction without reintroducing the rejected concrete-identity guard.
- **A reprocess of the document itself still loses the correction.** For
  `lab_result` the worker supersedes extracted rows rather than deleting them,
  so the corrected observation survives but is bound to the superseded row while
  the freshly extracted row starts uncorrected. → Out of scope and named as
  such; the durability this change guarantees is against EH-116 batch
  re-resolution, not against re-extraction.
- **Comparator handling stays imperfect.** Preserving `< 0.20` as text is
  correct but leaves the row non-numeric and therefore outside numeric trends.
  → Acceptable until #108 introduces a censoring model; the alternative is a
  human-attributed fabricated number.
- **`observed_at` becomes per-row editable** while acceptance still defaults it
  from the document. → The default is unchanged; only an explicit override
  differs from the document date. A row whose date differs is worth surfacing in
  the row copy so it does not read as an inconsistency.

## Migration Plan

1. Ship `047_eh119_observation_measurement_correction.sql` in one migration:
   add `measurement_override`, add `eh119_is_measurement_override` and its
   CHECK, recreate `write_observation_normalization_revision_v2_legacy` with the
   `value_correction` write kind and the override parameter, recreate
   `promote_observation_normalization_revision_v2` with the measurement
   projection and the widened short-circuit. Do not replace the EH-115 wrapper.
   End with `notify pgrst, 'reload schema'`.
2. No backfill. Every existing revision has a null override and therefore an
   effective measurement identical to its raw extraction, so the widened
   projection is a no-op for stored data on its first re-promotion.
3. Ship the writer, validator and API changes together with the migration; the
   route rejects `edit-value` until the migration is applied, so an early deploy
   degrades to today's behaviour rather than to a `500`.
4. Ship the UI last. The correction form is additive to the review row and can
   be released behind nothing more than the API's presence.
5. Rollback: the migration's down path is to recreate the two functions from
   `046` and drop the CHECK; the `measurement_override` column can be left in
   place and ignored, since nothing else reads it. Any revision written with an
   override remains valid data — its observation simply stops being re-projected
   from the override on the next write.

## Open Questions

- Should a restated unit that would cost a resolved row its definition be
  offered at all, or only be reachable after an explicit "this mapping no longer
  applies" step? The spec requires acknowledgement; the interaction that carries
  it is undecided.
- Should `observed_at` be editable per row in this change, or deferred until a
  document can hold more than one collection date? The issue names the date, so
  it is in scope here, but the only current source of a differing date is a
  reviewer's typing.
- Does a corrected row need to re-enter the acceptance selection when it was
  already accepted, or is a correction always a standalone action on a stored
  row? Current assumption: standalone, and acceptance selection is unchanged.
