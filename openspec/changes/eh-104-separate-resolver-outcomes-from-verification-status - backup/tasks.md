# EH-104 Tasks

## 1. Schema — verification columns + enum on revisions
- [ ] Migration `029_*`: expand `observation_normalization_revisions.verification_status` check to `pending|auto_verified|user_verified|manually_corrected|rejected`, keep `NOT NULL DEFAULT 'pending'`.
  - [ ] 1.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.1.b Execute the stated action through its approved boundary.
  - [ ] 1.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] Add `verification_decided_at timestamptz`, `verification_actor_type text check in ('system','user')`, `verification_actor_id uuid` to `observation_normalization_revisions`.
  - [ ] 1.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 1.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 1.2.c Exercise focused success and failure cases and capture evidence.

- [ ] Make `document_extracted_biomarkers.verification_status` `NOT NULL DEFAULT 'pending'` with the same five-value check (pre-acceptance review state).
  - [ ] 1.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.3.b Execute the stated action through its approved boundary.
  - [ ] 1.3.c Verify expected and failure behavior and record attributable evidence.

## 2. Schema — resolver_result includes partial everywhere (I2)
- [ ] Add `CHECK (resolver_result in ('resolved','ambiguous','partial','unmapped'))` to `document_extracted_biomarkers.resolver_result`.
  - [ ] 2.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.1.c Exercise focused success and failure cases and capture evidence.

- [ ] Add the same check to `measurement_resolution_shadow_events.resolver_result`.
  - [ ] 2.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.2.c Exercise focused success and failure cases and capture evidence.

- [ ] Confirm revisions (`025`) and observations (`025`) already enforce it.
  - [ ] 2.3.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.3.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.3.c Publish attributable findings and block unresolved or unsafe results.

## 3. Schema — cross-axis + rejected-terminal guards (I3, I3b, I7)
- [ ] DB CHECK (I3) on `observation_normalization_revisions`: verified ⇒ `resolver_result = 'resolved' AND measurement_definition_key IS NOT NULL`.
  - [ ] 3.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.1.b Execute the stated action through its approved boundary.
  - [ ] 3.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] Service guard (I3b) inside the writing RPC/service: when creating a verified revision, assert the selected `measurement_definition_key` has `maturity = 'reviewed'` (Registry/code). NOT a DB CHECK.
  - [ ] 3.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.2.b Execute the stated action through its approved boundary.
  - [ ] 3.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] Add `before update` trigger enforcing `rejected` terminality (I7) and setting `verification_decided_at` when status leaves `pending` (I8).
  - [ ] 3.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.3.c Exercise focused success and failure cases and capture evidence.

- [ ] Add `CHECK` constraints for actor/status invariants (I4, I5, I6).
  - [ ] 3.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.4.c Exercise focused success and failure cases and capture evidence.

## 4. Types — expand VerificationStatus + actor type
- [ ] `src/lib/biomarkers/types.ts`: `VerificationStatus = "pending" | "auto_verified" | "user_verified" | "manually_corrected" | "rejected"`.
  - [ ] 4.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.1.b Execute the stated action through its approved boundary.
  - [ ] 4.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] Add `VerificationActorType = "system" | "user"`.
  - [ ] 4.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 4.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 4.2.c Exercise focused success and failure cases and capture evidence.

- [ ] Update inline `verification_status` literal types (`normalization-policy.ts:26`, `normalization-review.ts`, `document-viewer.tsx:152`).
  - [ ] 4.3.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 4.3.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 4.3.c Verify no legacy path or invalid state remains and record evidence.

## 5. Explicit system decision source — defined, NOT wired (point 5 + review)
- [ ] Add `createAutomaticVerification()` that calls `decideAutomaticPromotion` and, when allowed, creates/activates a revision with `verification_status='auto_verified'`, `verification_actor_type='system'`, `verification_actor_id=NULL` (the reviewed-definition guard I3b applies).
  - [ ] 5.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 5.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 5.1.c Exercise focused success and failure cases and capture evidence.

- [ ] Do NOT add a runtime call site for `createAutomaticVerification()` in EH-104. Full wiring → EH-120.
  - [ ] 5.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 5.2.b Execute the stated action through its approved boundary.
  - [ ] 5.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] Do NOT infer `auto_verified` from `p_actor_id IS NULL` in the promote RPC (leave RPC unchanged).
  - [ ] 5.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 5.3.b Execute the stated action through its approved boundary.
  - [ ] 5.3.c Verify expected and failure behavior and record attributable evidence.

## 6. Storage ownership + DTO projection (point 2)
- [ ] Ensure observation DTOs project `resolver_result` + `verification_status` from the active revision, not from `document_extracted_biomarkers`.
  - [ ] 6.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 6.1.b Execute the stated action through its approved boundary.
  - [ ] 6.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] Enrich `src/app/api/biomarkers/route.ts`, `src/app/api/health-profile/route.ts`, `src/app/api/documents/[id]/route.ts` (`OBSERVATION_SELECT`) to carry both dimensions from the active revision.
  - [ ] 6.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 6.2.b Execute the stated action through its approved boundary.
  - [ ] 6.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] `observations` receives NO verification columns in EH-104.
  - [ ] 6.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 6.3.b Execute the stated action through its approved boundary.
  - [ ] 6.3.c Verify expected and failure behavior and record attributable evidence.

## 7. resolution_status projection sync (point 3)
- [ ] Extend the promotion path (RPC `promote_observation_normalization_revision` in `021` or the service layer) to also set `observations.resolution_status = target.resolver_result` in the same transaction (invariant I11).
  - [ ] 7.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.1.c Exercise focused success and failure cases and capture evidence.

- [ ] Confirm corrections that change the active revision's `resolver_result` also sync `observations.resolution_status`.
  - [ ] 7.2.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 7.2.b Perform the stated review or preflight against the defined invariants.
  - [ ] 7.2.c Publish attributable findings and block unresolved or unsafe results.

## 8. Fixtures (points 1, 2, 3)
- [ ] Extend `scripts/verify-observation-identity-runner.ts` and `scripts/verify-observation-provenance-runner.ts` to assert: enum values, I2 partial coverage, cross-axis guard (verified requires resolved + non-null definition), reviewed-definition service guard, and explicit system `auto_verified`.
  - [ ] 8.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 8.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 8.1.c Exercise focused success and failure cases and capture evidence.

- [ ] Add a promotion fixture asserting `observations.resolution_status` equals the active revision's `resolver_result` after promote/correction.
  - [ ] 8.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 8.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 8.2.c Exercise focused success and failure cases and capture evidence.

## 9. Validate
- [ ] `openspec validate` for the `eh-104` change.
  - [ ] 9.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 9.1.b Execute the stated action through its approved boundary.
  - [ ] 9.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] Confirm scoring eligibility path (`health-profile/route.ts:73`) is untouched.
  - [ ] 9.2.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 9.2.b Perform the stated review or preflight against the defined invariants.
  - [ ] 9.2.c Publish attributable findings and block unresolved or unsafe results.

- [ ] Confirm `normalization_revisions_active_manual_idx` is left unchanged.
  - [ ] 9.3.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 9.3.b Perform the stated review or preflight against the defined invariants.
  - [ ] 9.3.c Publish attributable findings and block unresolved or unsafe results.

- [ ] Confirm no runtime call to `createAutomaticVerification()` is added in EH-104.
  - [ ] 9.4.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 9.4.b Perform the stated review or preflight against the defined invariants.
  - [ ] 9.4.c Publish attributable findings and block unresolved or unsafe results.

