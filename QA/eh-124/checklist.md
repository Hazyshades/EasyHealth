# EH-124: Run accessibility and review-workflow QA

**Roadmap status:** In progress
**Build / environment:** `eh-124-run-accessibility-and-review-workflow-qa @ ecff24f`; local developer evidence environment; no authenticated UI environment
**Test run date:** `2026-08-13`
**Tester:** `engineering / CI evidence`
**Browser / screen reader:** `N/A for blocked manual cases; no supported pairing is documented`

## Current execution baseline

- No local authenticated test environment is configured in this workspace: only
  `.env.example` is present. Manual interface checks require a CI or deployed
  environment and a dedicated test account.
- The repository documents no supported browser and screen-reader pairing.
  The release owner must select and record that baseline before EH124-UI-05.
- No manual check in this checklist has been executed yet.

## What this checklist covers

This checklist verifies the user-facing **Documents** review workspace: source-document navigation, page and source-region fallback, correction and change-history controls where they are available, keyboard operation, screen-reader output, long evidence, absent ranges, and recovery actions. It is a release-gate record: an unexecuted test is never a pass.

The current product does not expose EH-120's complete verification-state workflow. Test the controls that exist; record EH-120-only transitions as **Blocked** rather than creating an artificial test path.

## Before you start

- [ ] Use a dedicated test account with access to **Documents**.
- [ ] Use only synthetic or de-identified documents.
- [ ] Record the build, browser, operating system, and screen-reader pairing above.
- [ ] Confirm the listed normal-path data has finished processing, unless the check intentionally tests processing or recovery.
- [ ] Confirm a release-owner-approved environment can provide the recovery fixtures without using production patient data.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH118-DOC-01` | `lab_data/sample_lab_report_english_mock.pdf`, a two-page synthetic text-layer lab report | Page switch, source-region highlight, zoom, keyboard navigation |
| `EH118-DOC-02` | Synthetic scanned PDF or image supplied by the QA environment; no selectable text | Page-only fallback, no invented highlight |
| `EH118-DOC-03` | Synthetic instrumental report with selectable text supplied by the QA environment | Study-finding source navigation |
| `EH118-DOC-04` | Older synthetic document processed before source-region support | Legacy and reprocess regression |
| `EH119-NUMERIC-01` | Synthetic lab report containing a correctable numeric result, range, unit, and date | Correction, validation, undo, history |
| `EH124-LONG-01` | `lab_data/eh124_synthetic_report_with_a_deliberately_long_filename_for_review_workspace_accessibility.pdf` | Layout and operability under long evidence |
| `EH124-MISSING-01` | `lab_data/eh124_missing_range_incomplete_identity_mock.pdf` | Missing range and raw/partial retention |
| `EH124-RECOVERY-01` | Dedicated QA environment configured to fail one initial workspace request and one page-preview request | Load and page-preview retry |
| `EH124-RECOVERY-02` | Dedicated QA environment with worker-offline/stuck-processing state and a controlled failed review write | Status retry, reprocess, and no-false-success behavior |

## Interface checks

### EH124-UI-01: A text-layer PDF links a selected result to its exact source

**Precondition:** `EH118-DOC-01` has finished processing and has a result with a source region on page 1 and another on page 2.

1. Go to **Documents** and open `EH118-DOC-01`.
2. Select a page-1 result that is not marked **page only**.
3. Use **Zoom in**, **Zoom out**, **Next page**, and **Previous page**.
4. Select the page-2 result.

**Expected result:** Each selection opens the correct page and highlights the quoted source row when a region is available. The highlight remains aligned through zoom. Page controls announce and display the active page. The browser window does not jump unexpectedly.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-02: Page-only and document fallback states are explicit

**Precondition:** `EH118-DOC-02` is processed; `EH118-DOC-04` is available before and after reprocessing.

1. Open `EH118-DOC-02` and select a result.
2. Confirm the source wording and preview state.
3. Open `EH118-DOC-04`, select a result, reprocess the document, and select the refreshed result.

**Expected result:** A scan/image fallback states that only the page is available and draws no arbitrary box. The older document remains usable before reprocessing; after reprocessing, available source links/regions are used. No error is presented as a completed review.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-03: Instrumental findings preserve source navigation

**Precondition:** `EH118-DOC-03` has finished processing and shows a finding with a source page.

1. Open `EH118-DOC-03` in **Documents**.
2. Select a listed finding.
3. Change page and return to the finding.

**Expected result:** The preview opens the finding's recorded page and presents its source text. It highlights a verified region when present; otherwise it clearly reports the page-only fallback.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-04: Keyboard-only review controls are usable

**Precondition:** `EH118-DOC-01` is open with extracted review rows; a pointer is not used.

1. Press `Tab` from the page start and record the focus order through back navigation, download/reprocess, page controls, zoom, page-group controls, row controls, selection, technical details, correction/history, and acceptance controls that are present.
2. Use `Enter` or `Space` to activate page navigation, row selection, disclosures, and one available review action.
3. Verify focus after each activation and after any recovery message that appears.

**Expected result:** Every available blocking control receives a visible focus indicator in a logical order. Keyboard activation works without moving focus to an unrelated location or losing the selected result/source context. Disabled controls do not activate.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-05: Screen-reader names and state changes are understandable

**Precondition:** A supported browser and screen-reader pairing is recorded above; `EH118-DOC-01` and `EH119-NUMERIC-01` are available.

1. Navigate the page, zoom, page-group, result-row, selection, technical-details, correction, undo, history, accept/confirm, and recovery controls using the screen reader.
2. Select results on different pages and trigger one validation failure in the correction form.
3. Expand a populated **Change history** section.

**Expected result:** Controls have names that state their purpose. The reviewer can identify page/source changes, recovery and error states, the affected correction field, and history disclosure/entries without relying on visual information. Any inaccessible blocking control is a failure and is triaged as P0.

**Result:** `Blocked`
**Notes / evidence link:** No documented supported browser and screen-reader baseline or authenticated QA environment; see **Current execution baseline**.

### EH124-UI-06: Long evidence remains readable and operable

**Precondition:** `EH124-LONG-01` is processed and opened at the narrowest supported viewport and a standard desktop viewport.

1. Read the filename, result name, value/reference text, source snippet, correction reason, and change history.
2. Activate the row, open available correction/history controls, and navigate to its source.
3. Repeat at the desktop viewport.

**Expected result:** Critical text is not clipped, overlapping, or hidden behind another control. All available controls remain reachable and distinguishable; source and correction functionality remains intact at both viewport sizes.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-07: Missing ranges and incomplete identity remain honest

**Precondition:** `EH124-MISSING-01` is processed and visible in **Extracted biomarkers**.

1. Open the result and inspect its value/reference information.
2. Open its mapping information and any available correction controls.
3. Keep the result raw or partial using the available review action.

**Expected result:** The missing range is not fabricated. The workspace plainly describes the incomplete identity, preserves the raw/partial result, and does not force an unsupported concrete mapping. A correction validation failure does not create a saved revision.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

### EH124-UI-08: Initial-load and page-preview failures are recoverable

**Precondition:** `EH124-RECOVERY-01` is configured by the QA environment before the run.

1. Open the configured document and allow the first workspace request to fail.
2. Select **Retry** after the error is shown.
3. Navigate to the page configured to fail its preview request.
4. Select **Retry page preview**.

**Expected result:** The workspace distinguishes the initial-load failure from the page-preview failure, offers the correct retry action for each, and keeps the document/review context after recovery. Neither failed request is displayed as a successful review.

**Result:** `Blocked`
**Notes / evidence link:** The release-owner-approved recovery environment is unavailable; see **Current execution baseline**.

### EH124-UI-09: Processing and failed review actions expose safe recovery

**Precondition:** `EH124-RECOVERY-02` is configured by the QA environment; the tester has a reviewable row.

1. Open the configured processing document.
2. Use **Retry status**, then use **Reprocess document** when the recovery notice remains.
3. On the configured reviewable row, perform the action arranged to fail.
4. Inspect the result and retry only after the environment has been restored.

**Expected result:** The workspace explains whether processing is unavailable or delayed and distinguishes checking status from reprocessing. A failed acceptance or correction remains visibly failed on the affected action/row, creates no false success, and succeeds only after a real retry against the restored service.

**Result:** `Blocked`
**Notes / evidence link:** The release-owner-approved recovery environment is unavailable; see **Current execution baseline**.

### EH124-UI-10: Correction and history regressions remain reviewable

**Precondition:** `EH119-NUMERIC-01` is open and the correction form is available.

1. Correct the result using the printed synthetic value and a reason.
2. Reload the workspace.
3. Open **Change history** for the result.
4. Undo the correction with a reason when the control is available, then reload.

**Expected result:** The corrected value is visible while the raw extraction remains visible and unchanged. History identifies the correction/reversal, actor, time, and reason. If undo is not exposed in the deployed build, record this case as Blocked and attach the available API/database evidence; do not claim it passed.

**Result:** `Blocked`
**Notes / evidence link:** Local workspace has no authenticated QA environment or dedicated account; see **Current execution baseline**.

## Developer evidence required

- [x] `pnpm test:eh118` passed locally on 2026-08-13 and proves source-region, page-only fallback, provenance matching, and scroll-ownership contracts. Evidence owner: engineering/CI.
- [x] `pnpm test:eh119` passed locally on 2026-08-13 and proves raw-versus-corrected projection, correction validation, idempotency, and correction-form contract. Evidence owner: engineering/CI.
- [x] `pnpm test:eh121` passed locally on 2026-08-13 and proves compact history rendering, source-safe audit projection, actor labels, ordering, and empty-state behavior. Evidence owner: engineering/CI.
- [x] `pnpm typecheck`, `pnpm check:ci-suite-coverage-contract`, and `pnpm check:ci-suite-coverage` passed locally on 2026-08-13. The coverage check reported 55 covered suites, 0 local-only, 0 orphaned, 0 partial, and 0 invalid. Evidence owner: engineering/CI.
- [x] `pnpm test:eh120`, `pnpm test:eh122`, and `pnpm test:eh123` passed locally on 2026-08-13. These are automated contract checks only; they do not replace manual UI verification.
- [x] Complete Docker Supabase database matrix passed locally on 2026-08-13 after `supabase db reset --local --yes` applied migrations `001` through `062`: EH-104 (42), EH-105 (16), EH-106 (38), PostgREST alias (8), EH-111 (14), EH-114 (7), alias order (5), stated axis (6), EH-118 (26), EH-119 (39), EH-120 (50), EH-121 (37), EH-122 (19), EH-113 (5), EH-116 (42), PR2 (45 across five files), resolver trace v2 (26), writer seam (17), and EH-123 (20). Evidence owner: engineering/CI.
- [ ] The deployed/CI environment proves authenticated document ownership and route availability for the manual run. Evidence owner: release owner.
- [ ] Every confirmed P0 defect has a GitHub issue link, owner, triage state, focused regression evidence, and manual retest result. Evidence owner: QA/engineering.
- [ ] The EH-124 regression report lists every automated command, manual result, environment, evidence artifact, defect link, and dependency-blocked case. Evidence owner: release owner.

## Out of scope or not manually testable yet

- **EH-120 verification workflow.** Verification-state transitions, record rejection, supersession, batch/retry semantics, and their controls are not delivered. Record these cases as **Blocked — EH-120 dependency**, not Pass or N/A.
- **OCR for scans.** A scan/image can be page-only; it must not be failed for lacking a source-region highlight.
- **Raw-PDF fallback highlighting.** When no page preview exists, the embedded PDF cannot automatically jump to a source region; verify the explanatory fallback instead.
- **Database append-only, concurrency, authorization, and migration guarantees.** These are developer-evidence contracts, not tester interface steps.
- **Unavailable authenticated environment or approved screen-reader baseline.** Mark affected manual cases Blocked and name the required environment/baseline. Do not infer a pass from static source review or prior automated tests.
