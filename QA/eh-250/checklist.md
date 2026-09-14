# EH-250: Health Profile assessment read projection

**Roadmap status:** Delivered; manual verification pending  
**Build / environment:** Authenticated product environment with seeded synthetic lab data required  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

The Health Profile API now supplies one profile-wide assessment lifecycle state to the Health Profile page and dashboard. The pages must show the same current, processing, outdated, or error state while keeping the existing score, readiness, observation-freshness, and document-processing details independent.

This change is read-only: it does not change uploaded records, assessment payloads, jobs, or score/readiness rules.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Use a synthetic profile with at least one completed, scoreable laboratory assessment for the normal and recalculation checks.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.
- [ ] Do not use SQL, production patient data, or browser developer tools for the manual checks.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH250-01` | Synthetic de-identified lab document containing LDL, HDL, and triglycerides with numeric values and printed ranges | Completed scoreable Health Profile |
| `EH250-02` | A second synthetic lab document for the same test account, with a changed numeric value and no patient identifiers | Starts a normal assessment recalculation through the product flow |
| `EH250-03` | Approved synthetic failure fixture or test environment that exposes a retryable/failed assessment job; no real patient data | Error-state and retry path |

## Interface checks

### EH250-UI-01: Current profile remains stable across entry points

**Precondition:** `EH250-01` is fully processed and the account has a completed Health Profile assessment.

1. Go to **Dashboard**.
2. Record the visible overall assessment and system-card values.
3. Go to **Health Profile**.
4. Reload the page and return to **Dashboard**.

**Expected result:** The same completed profile and scores remain visible on both screens. Neither screen shows a processing, outdated, or error lifecycle message when no recalculation is running. Per-system readiness and observation-freshness explanations remain visible only in their existing system/readiness surfaces.

**Result:** `Blocked` — not executed in this review; an authenticated product session was unavailable.  
**Notes / evidence link:** `________`

### EH250-UI-02: Recalculation preserves the last completed profile

**Precondition:** `EH250-01` is complete and `EH250-02` is safe to upload in the dedicated test account.

1. From the product flow, upload `EH250-02` or use the existing control that starts Health Profile recalculation.
2. While recalculation is visibly active, open **Dashboard**.
3. Open **Health Profile** in another navigation step and refresh it.
4. After processing completes, refresh both screens again.

**Expected result:** During queued or processing work, the existing completed system/overall values remain visible rather than disappearing. If the UI exposes lifecycle messaging, both screens show the same server-provided processing/outdated state. After completion, the screens converge on the new current profile. No score, readiness, marker-freshness, or document-processing label is replaced by the profile-wide lifecycle state.

**Result:** `Blocked` — not executed in this review; deterministic in-flight job timing requires an authenticated environment.  
**Notes / evidence link:** `________`

### EH250-UI-03: Failed assessment exposes retry without losing the profile

**Precondition:** `EH250-03` is loaded through an approved synthetic test fixture and the account still has a usable completed profile.

1. Go to **Health Profile**.
2. Observe the assessment lifecycle banner and visible profile values.
3. Select **Retry update** when the control is available.
4. Refresh **Dashboard** and **Health Profile** after the retry request finishes.

**Expected result:** The error lifecycle and safe error message are visible without removing the last usable profile. The retry control is shown only for the failed/retryable-failed state. Dashboard and Health Profile agree after refresh; neither invents a `current` state while the assessment remains failed.

**Result:** `Blocked` — not executed in this review; the required failure fixture and authenticated environment were unavailable.  
**Notes / evidence link:** `________`

### EH250-UI-04: Downstream lifecycle props remain narrow

**Precondition:** A completed synthetic profile is available and the account can open the dashboard widgets and Health Profile detail surfaces.

1. Open **Dashboard** and inspect the overall assessment widget.
2. Open **Health Profile** and inspect the overall assessment card.
3. Select a body-system marker to open the **Health Profile drawer**.
4. Compare any lifecycle message with the system readiness and observation-freshness details.

**Expected result:** The overall card, body map, drawer, and dashboard widget receive the same profile-wide lifecycle state. System readiness reasons and observation freshness continue to describe their own axes and are not converted into a profile-wide lifecycle state.

**Result:** `Blocked` — not executed in this review; an authenticated product session was unavailable.  
**Notes / evidence link:** `________`

### EH250-UI-05: Health Profile load failure is explicit

**Precondition:** Use an approved synthetic test environment that returns a 401 or 500 response for the Health Profile request; do not use real patient data.

1. Open **Dashboard**.
2. Observe the **Health assessment** widget.
3. Select **Open health profile** when the control is available.

**Expected result:** The dashboard shows **Health assessment is unavailable** with a safe error message and an **Open health profile** action. It does not show the misleading **No lab records yet** prompt, and a prior profile is not silently replaced with an empty assessment.

**Result:** `Blocked` — not executed in this review; the authenticated failure fixture was unavailable.
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:health-profile-assessment-read` — pure canonical/fallback projection matrix across every invalid payload and supported job status, retained numeric system scores, metadata precedence, and lifecycle mapping. The existing focused API/client regression commands below cover the surrounding boundaries. Evidence: local command passed after the review fixes.
- [x] `pnpm test:eh123`, `pnpm test:eh144`, `pnpm test:eh146`, `pnpm test:health-profile-drawer-status`, and `pnpm test:health-profile-reported-results` — existing assessment persistence, freshness, lifecycle, drawer, and reported-result regressions. Evidence: local focused commands passed before review fixes.
- [x] `pnpm check:ci-suite-coverage` and `pnpm check:ci-suite-coverage-contract` — the new verifier is registered and CI coverage remains complete. Evidence: local commands passed.
- [x] `openspec validate health-profile-assessment-read-projection --strict` — the delivered OpenSpec change remains valid. Evidence: local command passed after the review fix.
- [x] Review evidence — final independent Standards and Spec signoff both reported 0 findings after the request-scoped safe error, complete invalid-payload matrix, and behavior-only verifier cleanup. Registry documentation issue [#254](https://github.com/Hazyshades/EasyHealth/issues/254) is closed after canonical docs, generated checks, and Wiki publication.
- [ ] `pnpm typecheck` — blocked by pre-existing `DocumentType` errors for `consultation_note` and `discharge_summary` in unrelated document/timeline files; no EH-250 file is implicated. A maintainer must rerun typecheck after that baseline blocker is resolved.
- [x] Database/migration/RPC evidence — no migration, RPC, worker, job, assessment-version, receipt, or persistence changes are present in this read-only refactor. Evidence: committed diff and OpenSpec non-goals.
- [ ] Authenticated API failure-path evidence — the dashboard now checks `response.ok` before consuming the required successful-response assessment contract. A maintainer with an authenticated environment should capture 401/500 behavior without browser console errors before release.

## Out of scope or not manually testable yet

- Legacy, malformed, or freshness-policy-incompatible persisted JSON cannot be safely created through a product interface. Use `pnpm test:health-profile-assessment-read` as the required evidence; do not mark an unavailable UI path as tested.
- Score formulas, readiness groups, admission, exclusions, Registry catalog data, observation freshness rules, document processing, synthesis behavior, worker output, persistence schema, RPCs, realtime subscriptions, polling, and cross-query transaction consistency are out of scope for EH-250.
- The manual checks above require an authenticated seeded environment and deterministic recalculation/failure fixtures. Until those are supplied, keep their results `Blocked`, not `Pass`.
