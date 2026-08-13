## Context

The documents review flow already has durable resolver/verification foundations:

- EH-104 separates resolver outcomes from verification status, enforces reviewed-definition and source-lineage guards, and permits `auto_verified` at the database boundary.
- EH-112 preserves `resolved`, `partial`, `ambiguous`, and `unmapped` outcomes as distinct user-visible states and excludes incomplete outcomes from definition-specific consumers.
- EH-119 writes value and mapping corrections as append-only revisions and provides reversal semantics.
- EH-121 captures normalization promotions in the service-owned append-only change ledger.
- EH-122 delivers document-scoped low-risk exact batch verification, idempotent operation metadata, per-row outcomes, aggregate status, and audit-safe reversal.
- EH-116 reprocesses Registry decisions with digest/CAS protection and skips active human corrections.

The remaining gap is workflow ownership. `verification_status` is currently persisted on normalization revisions, extraction `status` and `is_current` carry separate review/lineage meanings, and no single transition contract owns record rejection or supersession. The automatic-promotion helper and `auto_verified` database guard exist, but the runtime writer always derives `user_verified` or `manually_corrected` for resolved results. Directly inferring lifecycle from any one of these fields would make rejected or superseded source rows visible to consumers and would make EH-123 recalculate from ambiguous history.

This design is limited to document-derived laboratory observations. Instrumental observation lineage remains owned by EH-105. Health Profile and assessment consumers must consume the resulting active projection but EH-120 does not change their scoring rules.

## Goals / Non-Goals

**Goals:**

- Establish an explicit, testable state machine with independent resolver, verification, and record-lifecycle axes.
- Make the document-extracted laboratory source row the canonical record-lifecycle owner, so a row can be rejected before acceptance and superseded during reprocessing without inventing an observation.
- Keep normalization revisions append-only and make every lifecycle/verification transition actor-, reason-, source-, and CAS-aware.
- Activate automatic verification through a trusted system-only path using the existing automatic-promotion policy and reviewed Registry contract.
- Preserve incomplete raw acceptance, manual correction, EH-116 reprocessing, EH-121 audit capture, and the delivered EH-122 batch contract.
- Make API/UI projections expose safe transition state and action availability while preventing client-selected actors, statuses, or candidate identities.
- Add deterministic unit, API, database, regression, and manual QA evidence for allowed and rejected transitions.

**Non-Goals:**

- Changing resolver scoring, alias governance, Registry maturity, compatibility rules, extraction confidence, or the four resolver outcomes.
- Adding a second batch-verification endpoint, changing EH-122 eligibility, or turning raw acceptance into batch verification.
- Recalculating assessments or invalidating caches; those are EH-123 consumers of the events and state produced here.
- Deleting revisions, observations, extracted evidence, or change-history events during rejection, reversal, or rollback.
- Introducing row-level reprocessing or allowing a caller to submit a candidate measurement key as an override.
- Applying this laboratory record lifecycle to instrumental observations or legacy observations with no document source.

## Decisions

### 1. Keep three state axes independent and assign one owner to each

The public document-review projection will return all three axes:

| Axis | Values | Canonical owner | Meaning |
| --- | --- | --- | --- |
| `resolution_status` | `resolved`, `partial`, `ambiguous`, `unmapped` | Active normalization revision, or explicitly marked preview when no revision exists | What the resolver can establish from source evidence; never a trust decision |
| `verification_status` | `pending`, `auto_verified`, `user_verified`, `manually_corrected` | Active normalization revision | Who/what accepted the concrete reviewed definition; `rejected` and `superseded` are never verification values |
| `record_status` | `active`, `rejected`, `superseded` | `document_extracted_biomarkers` for document-derived laboratory rows | Whether the source record participates in the current review/projection lifecycle |

`document_extracted_biomarkers.status` remains the extraction/review process status (`needs_review`, `pending_review`, `accepted`, and existing compatibility values). `is_current` and `superseded_at` remain lineage timestamps/compatibility fields, but a new `record_status` column becomes the explicit lifecycle state. A guarded migration backfills `active` from current rows, `superseded` from `is_current = false`, and `rejected` from explicit rejected extraction rows; contradictory legacy combinations fail preflight rather than being guessed.

Laboratory observations do not own a second mutable lifecycle value. Their read boundaries join the same-source extracted row and serialize its `record_status`; definition-specific consumers require both an active record and an active reviewed normalization revision. This keeps pre-accept rejection representable and prevents duplicated source/projection state from drifting. Instrumental observations remain outside this join.

**Alternative rejected:** derive lifecycle from `document_extracted_biomarkers.status`, `is_current`, or `observation_normalization_revisions.is_active` alone. Those fields describe different concerns and cannot distinguish a rejected current source from a superseded source or a pending accepted raw observation.

### 2. Enforce a transition matrix in one trusted service/database seam

The transition policy is pure and table-driven before it is persisted. The policy receives the current three-axis snapshot, source-current flag, actor type, reason code, expected revision/source identifiers, and operation identity. It returns one allowed transition or one stable rejection code.

The initial matrix is:

- Any active source with `partial`, `ambiguous`, or `unmapped` resolution may be retained as raw evidence only: `verification_status = pending`, no concrete definition, and no verified actor metadata.
- An active `resolved` source may become `user_verified` only through an authenticated owner action or the already-delivered EH-122 batch service, and only when the reviewed-definition/source/CAS rules pass.
- An active `resolved` source may become `manually_corrected` only through the existing correction writer with compatible source evidence, a user actor, and a required reason.
- An active `resolved` source may become `auto_verified` only through the system-only automatic path described below. A caller cannot request `auto_verified` by setting a payload field.
- A lifecycle transition from `active` to `rejected` requires an authenticated owner, an allowlisted reason code, and the current source/revision snapshot. It preserves raw evidence and all prior revisions.
- A reprocessing transition from `active` to `superseded` is service-only, carries the reprocess row identity, and is committed with the new extraction batch. It does not delete the old source or its revisions.
- `rejected` and `superseded` are terminal for that source row. A later correction or reprocess creates/uses a new source row; no direct reactivation mutates the old row.
- A verification reversal creates a pending successor revision through the existing append-only writer and leaves `record_status = active`; it is not a lifecycle reactivation.
- Active `user_verified` or `manually_corrected` decisions are protected from automatic or registry reprocessing. A changed candidate becomes an auditable skipped/pending result until a user explicitly corrects it.

The service locks the source row and active revision, checks owner/profile/document linkage, validates expected snapshots, and performs the state transition in one transaction. The request hash binds actor, source, expected revision, transition, reason, and operation id; retries reuse the same result, while a changed payload or stale snapshot returns a deterministic conflict.

**Alternative rejected:** let each route mutate `status`, `is_current`, or `verification_status` independently. That would reintroduce TOCTOU races and make the UI, worker, batch service, and RPC disagree about legal transitions.

### 3. Add a system-only automatic-verification writer path

Keep the current user-facing v2 writer signature and add a separate service-role automatic wrapper that delegates to the same private source-safe promotion implementation. The wrapper:

1. recomputes the resolver result from the current extracted evidence and effective measurement override;
2. invokes `decideAutomaticPromotion` with an explicit approved quality-gate/release decision;
3. requires `resolved`, a concrete reviewed definition, no missing/rejected candidate evidence, no manual override, an active source, and no protected human decision;
4. writes `verification_status = auto_verified`, `verification_actor_type = system`, `verification_actor_id = null`, and a decision timestamp;
5. records a deterministic request hash and persisted resolver trace/version metadata; and
6. captures the resulting verification transition through the EH-121 trigger-backed ledger.

The service wrapper is granted only to `service_role`; authenticated/anon callers cannot invoke it or select a system actor. The shared writer result/type unions are expanded to include `auto_verified`, while all existing user callers continue to derive user metadata from the authenticated profile.

Automatic verification is opt-in at the runtime call site, not a database default. Extraction remains `needs_review` until the automatic policy explicitly succeeds, so enabling the code path cannot silently auto-accept every extraction. A failed quality gate, incomplete outcome, stale row, non-reviewed definition, or manual decision produces a visible non-verified outcome rather than a fallback to `user_verified`.

**Alternative rejected:** overload the existing user acceptance route with an `auto` boolean or trust a client actor field. That would make the security boundary depend on request shape and could turn a raw acceptance into a system decision.

### 4. Make rejection and supersession append-only audit transitions

Add an additive lifecycle transition RPC/service seam with stable reason codes and expected source/revision checks. It updates the canonical source lifecycle state and compatibility lineage fields together. Direct authenticated updates to `record_status`, `is_current`, or `superseded_at` are denied or rejected by the database guard; the transition seam is the only runtime writer.

Extend the EH-121 event enum and ledger metadata with lifecycle transition events and prior/next record status plus a non-PII reason code. Automatic verification uses the existing verification event shape with system actor metadata; rejection and supersession use lifecycle-specific event kinds. Database triggers capture events after successful source/revision transitions, preserving idempotency and keeping TypeScript from inserting audit rows.

The ledger stores identifiers, enums, hashes, versions, actor metadata, and reason codes only. Raw labels, values, units, source text, resolver traces, and patient-entered free-form text are not copied into lifecycle metadata. Existing observation/revision history remains immutable and is never replaced by operation metadata.

**Alternative rejected:** encode rejection as `verification_status = rejected`, delete the observation, or use a client-written audit row. Each option loses the independent-axis contract or allows historical evidence to be rewritten.

### 5. Integrate reprocessing without overwriting human decisions

EH-116 reprocessing remains document-level and continues to record per-row `applied`, `skipped`, and `failed` outcomes. Before applying a candidate, it checks the source `record_status`, expected active revision, input evidence hash, and human-decision protection. Reprocessing supersedes the old source row only through the lifecycle seam and creates the next source batch as active.

If a source has an active manual correction or user verification, reprocessing retains the old active decision and records a skipped/needs-review candidate according to the existing EH-116 contract. If the source has no protected human decision and the new reviewed result passes the automatic policy, the automatic writer may create an `auto_verified` revision; otherwise it creates a pending candidate or reports a retryable failure. A retry never mutates the old trace or creates duplicate audit events.

### 6. Keep review UI and API projections state-aware

The document bootstrap and biomarker routes return `recordStatus`, persisted/preview trace state, verification status, and stable action-exclusion reasons. The UI renders resolver and verification as separate chips and treats rejected/superseded as lifecycle labels, not as failed medical results.

- Raw acceptance remains available for active partial/ambiguous/unmapped rows.
- Verification and batch verification remain limited to eligible resolved rows.
- Manual correction requires its existing evidence and reason flow.
- Reject is owner-scoped, reason-coded, and confirmed before mutation.
- Superseded rows are historical/read-only and point to the reprocess/replacement context.
- Automatic verification is displayed as a system decision and is not presented as a user action.

All routes use the existing authenticated owner assertion and no-store server pattern. The client may render a preview, but the server recomputes eligibility and action availability immediately before persistence.

**Alternative rejected:** hide rejected/ineligible rows from the review projection. The roadmap requires users to understand why a row was skipped, and hidden state would make audit and recovery impossible.

## Risks / Trade-offs

- **[Migration ambiguity]** Historical rows may have contradictory `status`, `is_current`, or revision combinations. → Run a read-only preflight; block persistent environments on findings and provide an explicit disposable reset/repair procedure rather than guessing.
- **[Consumer leakage]** A downstream query may read laboratory observations without the source lifecycle join. → Add a shared read-boundary helper/view, update all known consumers, and add a static/query regression that rejected or superseded sources cannot enter definition-specific projections.
- **[Automatic verification overreach]** A broad quality gate could promote a false mapping. → Reuse the reviewed-definition and hard-evidence policy, require a versioned release approval, keep the path service-only, and add negative fixtures for every incomplete/protected condition.
- **[Concurrent transitions]** Rejection, batch verification, correction, and reprocessing may race. → Lock the source and active revision, bind requests to expected snapshots, and return per-row stale conflicts without rolling back independent siblings.
- **[Audit schema growth]** New lifecycle events add enum and read-model cases. → Use additive migrations, stable reason-code allowlists, trigger capture, and explicit parser fallbacks that never fabricate a historical event.
- **[Partial rollout]** Application and database versions may not deploy together. → Deploy additive columns/functions and read compatibility first, then enable writers/UI, and leave automatic verification disabled until all guards and tests are green.
- **[Manual QA environment]** Authenticated review and concurrency scenarios may be unavailable locally. → Keep them as explicit blocked/required evidence in `QA/eh-120/checklist.md`; do not mark them passed from unit or pgTAP results.

## Migration Plan

1. Add and preflight the `record_status` column, reason-code constraints, lifecycle event fields, and additive event kinds. Backfill only unambiguous rows; abort persistent rollout on findings.
2. Add service-only lifecycle transition functions, direct-write guards, and trigger-backed EH-121 capture. Extend database fixtures for all three axes, actor metadata, CAS, grants, append-only history, and source lineage.
3. Add the automatic writer wrapper and expand shared TypeScript types/policies to represent `auto_verified`. Keep the call site disabled until the approved quality-gate fixture and release manifest are present.
4. Update EH-116 reprocessing to use the supersession seam and preserve protected human decisions. Add per-row retry/failure assertions.
5. Update document read routes, review projections, action guards, rejection confirmation, historical/superseded display, and safe reason wording. Keep EH-122 routes and selection semantics unchanged.
6. Run focused EH-120 unit/API/database suites, existing EH-104/EH-111/EH-116/EH-121/EH-122 regressions, typecheck/build, and authenticated manual QA. Update canonical resolver/review docs, generated Registry/Wiki outputs, QA checklist, and issue #20 evidence.

Rollback disables new automatic/rejection UI entry points and stops new lifecycle writes. It does not delete lifecycle columns, revisions, source evidence, or audit events. Existing rows remain readable through the compatibility projection until the forward fix is redeployed.

## Open Questions

- Confirm the final product-facing rejection reason labels and translations; the implementation must still persist stable non-PII reason codes rather than free-form text.
- Confirm which approved Registry release/quality-gate artifact enables automatic verification in production; absence of an approval must leave the path disabled, not silently fall back to user verification.
