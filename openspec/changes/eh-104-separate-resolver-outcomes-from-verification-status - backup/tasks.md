# EH-104 Tasks

## 1. Schema — verification columns + enum on revisions
- [ ] Migration `029_*`: expand `observation_normalization_revisions.verification_status` check to `pending|auto_verified|user_verified|manually_corrected|rejected`, keep `NOT NULL DEFAULT 'pending'`.
- [ ] Add `verification_decided_at timestamptz`, `verification_actor_type text check in ('system','user')`, `verification_actor_id uuid` to `observation_normalization_revisions`.
- [ ] Make `document_extracted_biomarkers.verification_status` `NOT NULL DEFAULT 'pending'` with the same five-value check (pre-acceptance review state).

## 2. Schema — resolver_result includes partial everywhere (I2)
- [ ] Add `CHECK (resolver_result in ('resolved','ambiguous','partial','unmapped'))` to `document_extracted_biomarkers.resolver_result`.
- [ ] Add the same check to `measurement_resolution_shadow_events.resolver_result`.
- [ ] Confirm revisions (`025`) and observations (`025`) already enforce it.

## 3. Schema — cross-axis + rejected-terminal guards (I3, I3b, I7)
- [ ] DB CHECK (I3) on `observation_normalization_revisions`: verified ⇒ `resolver_result = 'resolved' AND measurement_definition_key IS NOT NULL`.
- [ ] Service guard (I3b) inside the writing RPC/service: when creating a verified revision, assert the selected `measurement_definition_key` has `maturity = 'reviewed'` (Registry/code). NOT a DB CHECK.
- [ ] Add `before update` trigger enforcing `rejected` terminality (I7) and setting `verification_decided_at` when status leaves `pending` (I8).
- [ ] Add `CHECK` constraints for actor/status invariants (I4, I5, I6).

## 4. Types — expand VerificationStatus + actor type
- [ ] `src/lib/biomarkers/types.ts`: `VerificationStatus = "pending" | "auto_verified" | "user_verified" | "manually_corrected" | "rejected"`.
- [ ] Add `VerificationActorType = "system" | "user"`.
- [ ] Update inline `verification_status` literal types (`normalization-policy.ts:26`, `normalization-review.ts`, `document-viewer.tsx:152`).

## 5. Explicit system decision source — defined, NOT wired (point 5 + review)
- [ ] Add `createAutomaticVerification()` that calls `decideAutomaticPromotion` and, when allowed, creates/activates a revision with `verification_status='auto_verified'`, `verification_actor_type='system'`, `verification_actor_id=NULL` (the reviewed-definition guard I3b applies).
- [ ] Do NOT add a runtime call site for `createAutomaticVerification()` in EH-104. Full wiring → EH-120.
- [ ] Do NOT infer `auto_verified` from `p_actor_id IS NULL` in the promote RPC (leave RPC unchanged).

## 6. Storage ownership + DTO projection (point 2)
- [ ] Ensure observation DTOs project `resolver_result` + `verification_status` from the active revision, not from `document_extracted_biomarkers`.
- [ ] Enrich `src/app/api/biomarkers/route.ts`, `src/app/api/health-profile/route.ts`, `src/app/api/documents/[id]/route.ts` (`OBSERVATION_SELECT`) to carry both dimensions from the active revision.
- [ ] `observations` receives NO verification columns in EH-104.

## 7. resolution_status projection sync (point 3)
- [ ] Extend the promotion path (RPC `promote_observation_normalization_revision` in `021` or the service layer) to also set `observations.resolution_status = target.resolver_result` in the same transaction (invariant I11).
- [ ] Confirm corrections that change the active revision's `resolver_result` also sync `observations.resolution_status`.

## 8. Fixtures (points 1, 2, 3)
- [ ] Extend `scripts/verify-observation-identity-runner.ts` and `scripts/verify-observation-provenance-runner.ts` to assert: enum values, I2 partial coverage, cross-axis guard (verified requires resolved + non-null definition), reviewed-definition service guard, and explicit system `auto_verified`.
- [ ] Add a promotion fixture asserting `observations.resolution_status` equals the active revision's `resolver_result` after promote/correction.

## 9. Validate
- [ ] `openspec validate` for the `eh-104` change.
- [ ] Confirm scoring eligibility path (`health-profile/route.ts:73`) is untouched.
- [ ] Confirm `normalization_revisions_active_manual_idx` is left unchanged.
- [ ] Confirm no runtime call to `createAutomaticVerification()` is added in EH-104.
