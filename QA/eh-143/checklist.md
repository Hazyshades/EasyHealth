# EH-143: Readiness and null-result contract

**Roadmap status:** In progress
**Build / environment:** `Next.js dev server :3013; Supabase CLI 2.109.0; Docker Engine 29.6.2; local Docker project easyhealth`
**Test run date:** `2026-08-23`
**Tester:** `Engineering local E2E session`

## What this checklist covers

The **Health Profile** shows a numeric current-state assessment only when the relevant named body system has every required usable laboratory group. Missing or unusable evidence must show an unavailable assessment, not a partial score or `0`.

When a recalculation is in progress after source data changes, the prior assessment is withheld rather than presented as current. This is a technical product state, not medical advice and not a statement that a laboratory result is invalid.

## Before you start

- [ ] Use a dedicated test account with no real patient data.
- [ ] Use only synthetic or de-identified laboratory documents created for this test.
- [ ] Confirm the test documents are **ready** and their extracted biomarkers have been accepted, unless the check intentionally exercises an update in progress.
- [ ] Record the current build or deployment identifier above.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH143-COMPLETE-01` | Synthetic laboratory document with document-native numeric reference bounds and accepted required groups for Cardiovascular (LDL or non-HDL, HDL, triglycerides), Metabolic (fasting glucose or HbA1c), and Thyroid (TSH and free T4). | Proves numeric system and overall assessment availability after three complete named systems. |
| `EH143-INCOMPLETE-01` | Synthetic document containing LDL only, with a numeric document-native reference bound. | Proves all eight named systems remain visible but no partial score is shown when required groups are absent. |
| `EH143-INVALID-01` | Synthetic Cardiovascular document with LDL, HDL, and triglycerides where one required result has no document-native reference bound. | Proves a present but unusable required result does not unlock a score. |
| `EH143-UPDATE-01` | A dedicated account with a completed Health Profile assessment, followed by accepting or reprocessing a synthetic laboratory result that queues assessment recalculation. | Proves an obsolete score is withheld while the update is pending. |

## Interface checks

### EH143-UI-01: Incomplete named-system assessment stays unavailable

**Precondition:** `EH143-INCOMPLETE-01` is accepted on the dedicated account; no other accepted synthetic results complete a named-system minimum.

1. Go to **Health Profile**.
2. Confirm the body map and system chips show the eight named body systems.
3. Open **Cardiovascular** from the map or its system chip.
4. Review the current-state assessment and the guidance in the detail drawer.

**Expected result:** Cardiovascular and every other named system display an unavailable score (`-`), never `0/100` or a partial average. The Cardiovascular drawer lists the missing alternatives needed for its current-state assessment. The accepted LDL result remains visible as factual data.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH143-UI-02: Present but unusable required result does not score

**Precondition:** `EH143-INVALID-01` is accepted, and all other Cardiovascular required groups are present with usable document-native bounds.

1. Go to **Health Profile**.
2. Open **Cardiovascular**.
3. Review the current-state assessment and readiness guidance.

**Expected result:** Cardiovascular remains unscored. The drawer states that the present required marker is not usable for this assessment; it does not tell the tester that the source laboratory result itself is invalid. No numeric Cardiovascular or overall score appears because of that unusable result.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH143-UI-03: Approved alternative unlocks readiness

**Precondition:** Start from `EH143-COMPLETE-01`, then use either LDL or non-HDL cholesterol as the accepted atherogenic-cholesterol result while leaving the other alternative absent.

1. Go to **Health Profile**.
2. Open **Cardiovascular**.
3. Verify the other Cardiovascular required results are present with document-native reference bounds.

**Expected result:** Cardiovascular has one numeric current-state assessment. The absent sibling alternative is not shown as a missing requirement, and the result is not counted twice.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH143-UI-04: Overall assessment needs three complete named systems

**Precondition:** `EH143-COMPLETE-01` is accepted.

1. Go to **Health Profile**.
2. Verify that Cardiovascular, Metabolic, and Thyroid each have a numeric assessment.
3. Review the overall assessment card.
4. Remove or invalidate one synthetic required result through the normal test-data workflow, then wait for its assessment update to finish and reload **Health Profile**.

**Expected result:** With three complete named systems, a numeric overall assessment appears and identifies its system denominator. Once fewer than three systems are complete, the overall assessment becomes unavailable; it is never a partial average.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH143-UI-05: Updating assessment does not show an old score as current

**Precondition:** `EH143-UPDATE-01` has a completed Health Profile assessment with at least one numeric system score.

1. Use the normal document review or reprocess flow to change the accepted synthetic laboratory evidence and queue Health Profile recalculation.
2. Open or reload **Health Profile** before the recalculation job completes.
3. Open a named-system drawer and review the overall assessment card.

**Expected result:** The page identifies that the Health Profile assessment is updating. Named-system and overall scores are withheld, and the drawer says the previous score is not shown as current. Factual marker and source information remain visible. After recalculation succeeds and the page is reloaded, score availability is recalculated from current evidence.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] Engineering ran `pnpm test:eh143` on 2026-08-23. It passed and proves every scoreable named system requires all runtime readiness groups, approved alternatives satisfy only their own group, context-only input cannot unlock readiness, unavailable scores are `null`, and stale-score suppression adds the `outdated` reason. **Provider:** engineering.
- [x] Engineering ran `pnpm test:health-profile-lab-input` and `pnpm test:biomarkers` on 2026-08-23. Both passed and prove the existing Registry-v2 Health Profile projection and biomarker aggregation regression contracts still pass. **Provider:** engineering.
- [x] Engineering ran `pnpm typecheck` on 2026-08-23. It passed and proves all first-party API and presentation consumers migrated away from the retired readiness arrays. **Provider:** engineering.
- [x] Engineering ran `pnpm check:ci-suite-coverage` and `pnpm check:ci-suite-coverage-contract` on 2026-08-23. Both passed; `test:eh143` is registered in the `verify` CI job and policy. **Provider:** engineering.
- [x] Controlled local backend capture completed on 2026-08-23. With one authenticated dedicated user, a persisted canonical assessment, and each of `queued`, `processing`, `retryable_failed`, and `failed`, `GET /api/health-profile` returned `assessment_freshness: "outdated"`, `null` named-system and overall scores, an `outdated` reason for every named system, and retained source evidence. Restoring `succeeded` returned three numeric named scores and the numeric overall score. **Provider:** engineering.
- [x] Database-test applicability confirmed on 2026-08-23. EH-143 changes no schema, constraint, RPC, or persistence boundary; `pnpm test:eh123-db` passed all 20 assessment-job and version-persistence tests after the approved disposable `supabase db reset --local`. **Provider:** engineering.
- [x] Controlled local browser E2E completed on 2026-08-23 with the same dedicated account and synthetic persisted assessment fixture. The visible UI showed current scores `95`, `90`, `85` and overall `90` when succeeded; suppressed every score plus the update banner/card and drawer state when processing; and showed the exact invalid-evidence message for a present ALT result without a document-native range. This validates the response-to-UI path, not the normal document-review/reprocess workflow. **Provider:** engineering.
- [ ] Clinical Product provides EH-141 sign-off evidence for the required-group policy; this checklist does not substitute for clinical approval.
- [ ] Backend or QA provides EH-142 evidence that only verified, resolved, reviewed, numeric, range-eligible observations reach this evaluator.

## Out of scope or not manually testable yet

- No biological age or medical-expiry threshold is introduced. `outdated` means the persisted Health Profile assessment snapshot is superseded by a non-succeeded recalculation job.
- Registry group membership, clinical rationale, and context-only policy approval remain EH-141 scope.
- Verification, resolution, lifecycle, and document-native range admission remain EH-142 scope.
- The local E2E session exercised the product UI with direct synthetic database fixtures. The normal document-review/reprocess workflow was not used to create those fixture states, so the five manual scenarios remain available for a tester to execute end to end.
