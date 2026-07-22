## Why

Observations can be resolved, ambiguous, partial, or unmapped (resolver outcome) and, separately, pending, auto-verified, user-verified, manually-corrected, or rejected (verification trust). Today these two dimensions are entangled and incomplete:

- `observations` carries the resolver outcome (`resolution_status`) but NO verification status; verification lives only on `observation_normalization_revisions` and is projected inconsistently across DTOs.
- `auto_verified` does not exist anywhere. `decideAutomaticPromotion` is defined and unit-tested but never invoked at runtime, so no automatic verification path is wired end-to-end.
- `document_extracted_biomarkers` is still read as authoritative verification state after an observation exists, which conflicts with the active-revision model.
- `resolver_result` is not constrained on `document_extracted_biomarkers` or the shadow-events table, so `partial` is not guaranteed across every DB contract.

EH-104 establishes the schema contract, storage ownership, and minimal cross-axis DB guards so an incomplete mapping is never treated as a trust decision. The full verification workflow, permissions, reasons, batch operations, UI, and reprocessing transitions belong to EH-120; end-to-end persistence and UI wording for partial/ambiguous/unmapped belong to EH-112.

## What Changes

- Expand `observation_normalization_revisions.verification_status` to `NOT NULL DEFAULT 'pending'` with values `pending`, `auto_verified`, `user_verified`, `manually_corrected`, `rejected`.
- Add `verification_decided_at timestamptz`, `verification_actor_type text check in ('system','user')`, `verification_actor_id uuid` to `observation_normalization_revisions` (the decision record). `observations` receives NO verification columns in EH-104.
- Guarantee `resolver_result` ∈ {resolved, ambiguous, partial, unmapped} in every DB contract: add the missing check to `document_extracted_biomarkers.resolver_result` and `measurement_resolution_shadow_events.resolver_result` (revisions and observations already enforce it).
- Establish storage ownership: the **active normalization revision is the single source of truth** for resolver outcome + verification; `document_extracted_biomarkers` holds only the pre-acceptance review state and is not authoritative after an observation is created.
- Add minimal cross-axis DB guards: a verified row must be `resolved` with a non-null `measurement_definition_key` (DB CHECK); additionally the selected definition MUST be `reviewed`, enforced as a service guard inside the writing RPC (maturity lives in the code Registry, not the DB). A `rejected` revision is terminal on its row (reprocessing creates a new revision).
- Synchronize `observations.resolution_status` from the active revision during promotion so it is an atomically-synced projection, not a divergent copy.
- Introduce an explicit system decision source `createAutomaticVerification()` that produces `auto_verified` (`verification_actor_type='system'`, `verification_actor_id=NULL`). **EH-104 defines this API but does NOT invoke it at runtime**; the runtime call site is wired in EH-120.
- Enrich observation DTOs to project `resolver_result` and `verification_status` from the active revision (the review UI already does this; the biomarkers list and health-profile DTOs do not).

## Capabilities

### New Capabilities

- `observation-resolution-verification`: Resolver-outcome and verification-status are modeled, stored, and exposed as independent dimensions with cross-axis guards.

## Impact

- Database: additive verification columns on revisions; enum expansion; `resolver_result` check added to extracted + shadow tables; DB guard (verified ⇒ resolved + definition present) + rejected-terminal trigger.
- APIs: observation DTOs expose `resolver_result` and `verification_status` projected from the active revision; `observations.resolution_status` stays equal to the active revision via promotion sync.
- Fixtures: runner scripts assert the enum, cross-axis guard, reviewed-definition service guard, and `observations.resolution_status` == active revision `resolver_result` after promotion.
- No change to scoring eligibility (kept as `resolution_status = resolved` + reviewed assessment binding per `strict-system-score-readiness-2`).
- No change to `normalization_revisions_active_manual_idx` (its serving query was not identified in the codebase; left untouched).

## Scope Boundary

- EH-104 owns: schema contract, storage ownership, minimal cross-axis DB guards, DTO projection, `resolution_status` promotion sync, explicit system auto-verification API (defined, not wired), fixtures.
- EH-112 owns: end-to-end persistence/serialization of partial/ambiguous/unmapped, UI wording, trends/assessment exclusion, metrics.
- EH-120 owns: full verification state machine, permissions, reasons, batch API, UI actions, reprocessing/manual-decision transitions, **and runtime activation of `auto_verified`**.
- Scoring eligibility stays with `strict-system-score-readiness-2` (EH-143/145 cluster); EH-104 does not alter it.

## Out of Scope

- Runtime activation/wiring of `auto_verified` (defines API only) → EH-120.
- Full verification workflow / state machine / UI / batch → EH-120.
- Partial/ambiguous/unmapped UI wording and trends exclusion → EH-112.
- Scoring changes → scoring cluster.
- Modifying `normalization_revisions_active_manual_idx`.
- Removing `observations.resolution_status` (kept as a projection) or adding verification columns to `observations` (deferred until the active-revision model is proven stable).
