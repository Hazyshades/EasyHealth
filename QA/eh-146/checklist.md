# EH-146: Finalize system states and body-map behavior

**Roadmap status:** Implemented; full-stack verification passed (UI, API, DB in local Supabase Docker)
**Build / environment:** Windows 11 local EasyHealth workspace, EH-146 worktree served on `localhost:3100` (port 3000 is occupied by the EH-145 worktree dev server), local Supabase Docker at `127.0.0.1:54321`. Executed: `pnpm test:eh146`, `pnpm test:health-profile-lab-input`, `pnpm test:biomarkers`, `pnpm test:eh123`, `pnpm test:eh131`, `pnpm typecheck`, `supabase test db` (EH-123 assessment recalculation, service-role access), plus an authenticated browser E2E against real job/version RPC data.  
**Test run date:** 2026-08-23  
**Tester:** Engineering verification

## What this checklist covers

This checklist covers the Health Profile body map and assessment cards after EH-143 strict readiness and EH-145 provenance work. It verifies that a numeric value is presented only as a factual current-state assessment, that insufficient evidence is neutral rather than a failure, and that background assessment lifecycle states are clearly separated from evidence state.

The manual paths use only synthetic or de-identified laboratory documents. They do not validate a diagnosis, disease risk, treatment decision, or clinical emergency.

## Before you start

- [x] Use a dedicated authenticated test account (`eh146-test@easyhealth.local`, magic-link sign-in via local Mailpit).
- [x] Use only synthetic or de-identified documents; do not upload real patient data.
- [x] Prepare one synthetic document with enough reviewed, reference-ranged markers to produce at least one scoreable system.
- [x] Prepare one synthetic document with a single recognized marker or missing reference ranges so at least one named system is insufficient.
- [x] Confirm the selected test profile owns every document used in the checks.
- [x] For lifecycle checks, drive the real assessment-job RPCs (`claim`/`complete`/`fail`/`retry`) against the local Docker database.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH146-SCORED-01` | Synthetic laboratory report (`EH146 synthetic lab.pdf`, 2026-08-20, Synthetic Laboratory) with reviewed registry bindings: LDL 90 mg/dL (0–100), HDL 55 mg/dL (40–100), triglycerides 100 mg/dL (0–150) | Scoreable cardiovascular system (score 95) and factual score presentation |
| `EH146-INSUFFICIENT-01` | Same document adds glucose 5.2 mmol/L (3.9–5.5) only for metabolic | Insufficient readiness without a failure/danger state |
| `EH146-PROCESSING-01` | Real fallback path: observations present, no persisted version, no job row | Processing lifecycle state |
| `EH146-OUTDATED-01` | Persisted version plus a queued job created by a real `observation_change_events` insert | Outdated lifecycle state |
| `EH146-ERROR-01` | `fail_assessment_recalculation_job` on the claimed job (`eh146_test_failure`) | Error/retry lifecycle state |
| `EH146-DEEP-01` | `?system=cardiovascular&returnTo=%2Fapp%2Fbiomarkers` and `?system=not_a_system` | Deep-link, back/forward, and source-return behavior |

Test profile: `db1a3b93-fbd4-4e6b-9246-cffc3caf3013` (local Docker only). Version rows were produced by the worker-parity path (`scripts/eh146-e2e-complete-job.ts` calls `buildHealthProfileSnapshot` + `complete_assessment_recalculation_job`), not hand-written payloads.

## Interface checks

### EH146-UI-01: Scored system is factual

**Precondition:** `EH146-SCORED-01` is processed for the signed-in test profile and the Health Profile contains a scoreable named system.

1. Go to **Health Profile** (`/app/profile`).
2. Locate the system badge or selector for the scoreable system.
3. Hover the badge, then focus it with the keyboard.
4. Open the system using the pointer and then repeat using Enter or Space.
5. Review the drawer's score, data confidence, marker values, lab-reference status, observed date, and source document link.

**Expected result:** The badge and drawer show a numeric **Current state assessment** with a separate **Data confidence** value. The tooltip and drawer describe factual records and reference ranges; neither says diagnosis, disease risk, probability, treatment, or emergency.

**Result:** `Pass`  
**Notes / evidence link:** Heart badge exposes `aria-label="Heart: 95 of 100 current-state assessment. Assessment status: Current assessment. This is the latest completed current-state assessment from your records. It is not a diagnosis or disease-risk score."` plus `aria-haspopup="dialog"`, `aria-pressed`, `tabindex=0`, `data-assessment-state="current"`, and a matching native `title` tooltip. Drawer shows **Current state assessment 95/100**, **Data confidence 85%**, chip **Mostly within reference ranges**, primary source (filename, lab, date, `Open source document`), per-marker factual rows with SI display conversion (`2.33 mmol/L · Converted for display · Original: 90 mg/dL`) and `View measurement history` links.

### EH146-UI-02: Insufficient evidence is neutral

**Precondition:** `EH146-INSUFFICIENT-01` is processed and at least one named system has missing required groups or required markers without usable reference ranges.

1. Open **Health Profile**.
2. Locate the insufficient system on the body map and in the system selectors.
3. Hover or focus its badge/selector.
4. Open the system drawer.
5. Review the readiness explanation and the upload-document control.

**Expected result:** The system shows an em dash (`—`) and neutral muted styling. The drawer says the assessment is unavailable/not scored, lists missing or unusable readiness groups, preserves factual markers, and does not show `0`, a red danger state, a diagnosis, or a disease-risk claim.

**Result:** `Pass`  
**Notes / evidence link:** Metabolic badge and selector render `—` (map, chip row, and list). Drawer shows **Current state assessment —**, neutral **Assessment unavailable** chip, heading **Not scored - incomplete core**, readiness list **Needed for this assessment: fasting_glucose or hba1c**, an `Upload a document` control, and preserves the factual glucose row (5.2 mmol/L, within lab reference range). API confirms `metabolic.state_score = null`, `scoreability = "incomplete"`; overall card shows **Insufficient data for overall assessment — based on 1 of 8 systems** with the non-diagnostic disclaimer.

### EH146-UI-03: Processing and outdated states are distinct

**Precondition:** `EH146-PROCESSING-01` and `EH146-OUTDATED-01` are available as isolated local fixtures.

1. Open **Health Profile** for the no-version processing fixture.
2. Confirm the lifecycle notice and body-map/card labels.
3. Open the outdated fixture with a persisted completed version and a queued/processing job.
4. Confirm the last completed snapshot remains visible while the newer update is pending.

**Expected result:** The no-version fixture says **Assessment processing**. The persisted-version fixture says **Assessment update available** or **outdated** and identifies the visible score as the last completed assessment. Neither lifecycle state is presented as a health result or danger state.

**Result:** `Pass`  
**Notes / evidence link:** Fallback (no version, no job): `GET /api/health-profile` returned `assessment.status="queued"` (derived), `display_state="processing"`, `has_current_version=false`, `fallback=true`; page banner **Assessment processing** with the non-diagnostic description; fallback snapshot still scored Heart 95 from seeded observations. Outdated (version + job queued via real `observation_change_events` trigger): `display_state="outdated"`, banner **Assessment update available** with copy "The latest completed current-state assessment remains visible while a newer update is prepared…", and Heart: 95 remained rendered.

### EH146-UI-04: Error state preserves factual evidence and retry

**Precondition:** `EH146-ERROR-01` is available with a failed or retryable-failed assessment job.

1. Open **Health Profile**.
2. Read the lifecycle notice and any displayed last completed assessment.
3. Confirm the error text describes the recalculation/update failure, not the user's health.
4. Select **Retry update** once.

**Expected result:** The page identifies **Assessment update failed**, keeps the last completed snapshot visible when one exists, and offers retry only for failed/retryable jobs. No error copy is a diagnosis, risk score, emergency, or red health state.

**Result:** `Pass`  
**Notes / evidence link:** After the real `fail_assessment_recalculation_job` RPC the API returned `display_state="error"`, `status="retryable_failed"`, `error_code="eh146_test_failure"`, and the synthetic error message; the page showed **Assessment update failed**, the non-diagnostic description, the error message, the **Retry update** button, and kept Heart: 95 visible. Clicking **Retry update** called `POST /api/health-profile/recalculate` (worker `retry_assessment_recalculation_job`), the page refreshed to **Assessment update available** (`display_state="outdated"`, `status="queued"`). Completing the job restored `display_state="current"` with no banner.

### EH146-UI-05: Keyboard navigation and dialog focus

**Precondition:** A scoreable or insufficient system is visible in the body map.

1. Tab through the map controls until a system badge receives visible focus.
2. Press Enter; confirm the drawer opens and focus moves into the dialog.
3. Press Escape, reopen the drawer, and activate the system with Space.
4. Use **Back** or **Close**, then inspect the selected chip and URL query.

**Expected result:** Every system control is reachable by keyboard, has button semantics and a pressed state, and opens the same factual drawer as pointer activation. Escape/Back/Close closes the drawer without losing the safe selected-system context.

**Result:** `Pass`  
**Notes / evidence link:** Badges are focusable (`tabindex=0`); focusing the Thyroid badge and pressing **Enter** opened the drawer titled "Thyroid" with focus inside the dialog (`document.activeElement` contained by `#health-profile-drawer`); **Escape** closed it; **Space** reopened it; **Escape** closed it again. Pointer activation opened the identical drawer (role="dialog", aria-modal, labelledby). Drawer Back/Close buttons and overlay click are present.

### EH146-UI-06: Mobile body map remains complete

**Precondition:** Use a profile containing all named-system placeholders and set the browser viewport to a narrow mobile width (for example 390×844).

1. Open **Health Profile** at the narrow viewport.
2. Confirm the page has no horizontal scrollbar or clipped source controls.
3. Confirm all system selectors remain visible/reachable and insufficient badges remain distinguishable.
4. Open a system drawer and follow its source-document link.

**Expected result:** The map fits the viewport without a desktop-height blank panel or hidden systems. Selectors wrap/reach by touch and keyboard, the drawer remains usable, and source links/disclaimers remain available.

**Result:** `Pass`  
**Notes / evidence link:** At 390×844: `scrollWidth = clientWidth = 390` (no horizontal overflow), 10 selector chips wrap in the flex-wrap row, all 8 body-map badges render, map container measures 358×669 (no desktop-height blank panel), and the opened drawer measures exactly 390px (`left=0, right=390`, computed `width:390px; max-width:448px`) with `Open source` links and a Close button. An earlier 448px drawer reading was a viewport-transition artifact; the computed-style measurement at `innerWidth=390` is authoritative.

### EH146-UI-07: Deep link and same-origin return path

**Precondition:** `EH146-DEEP-01` has a selected system and safe internal return path.

1. Open `/app/profile?system=<named-system>&returnTo=%2Fapp%2Fbiomarkers` directly.
2. Confirm the matching selector and drawer open after Health Profile data loads.
3. Clear the selection and confirm the `system` query is removed while the safe return path remains.
4. Use browser back/forward and repeat with an invalid system value.
5. Follow a source-document link and return through the breadcrumb/back control.

**Expected result:** Direct, changed, and browser-history selections stay in the Health Profile context. Invalid system values fall back to no selection. The return path remains same-origin; no external URL is opened, and source navigation returns to the selected context.

**Result:** `Pass`  
**Notes / evidence link:** `?system=cardiovascular&returnTo=%2Fapp%2Fbiomarkers` opened the Heart drawer with the Heart selector active after data load. `?system=not_a_system` produced no drawer and no pressed control (graceful fallback). Toggling a selection off rewrote the URL to `?returnTo=%2Fapp%2Fbiomarkers` (system param removed, same-origin returnTo preserved). Browser **Back** returned to the cleared URL with the drawer closed; **Forward** restored `?system=metabolic` and the popstate listener reopened the Metabolic drawer.

## Developer evidence required

- [x] `pnpm test:eh146` proves queued/processing/current-version mapping, failed/retryable error mapping, neutral null-score helpers, strict incomplete readiness, and scoreable readiness. Owner: engineering. Passed on 2026-08-23.
- [x] `pnpm typecheck` proves the API metadata, dashboard data, map/drawer props, and responsive page changes compile. Owner: engineering. Passed on 2026-08-23.
- [x] Targeted existing Health Profile/Registry regression commands pass without changing readiness or score formulas. Owner: engineering. `pnpm test:health-profile-lab-input`, `pnpm test:biomarkers`, `pnpm test:eh123`, and `pnpm test:eh131` passed on 2026-08-23 (re-run after the E2E).
- [x] Database evidence in local Supabase Docker: `supabase test db --local supabase/tests/eh123_assessment_recalculation.sql` — 20 tests PASS (job claim/complete/fail/retry lifecycle, append-only versions, receipts); `QA-Db_tests/service_role_access_contract.sql` — 4 tests PASS.
- [x] API evidence: `GET /api/health-profile` returned the full lifecycle matrix against live data — no version/no job → `processing` (derived `queued`, `fallback=true`); version + succeeded → `current` with `version_id`; version + queued → `outdated`; retryable_failed → `error` with `error_code`/`error_message`; unauthenticated request → `401 {"error":"Unauthorized"}`. `display_state`/`has_current_version` are derived per request, never persisted in version payloads.
- [x] Worker-parity evidence: the persisted version was produced by the production path (`buildHealthProfileSnapshot` + `complete_assessment_recalculation_job` RPC via `scripts/eh146-e2e-complete-job.ts`), so UI scores come from a real append-only version, not a hand-written payload.
- [x] Dashboard widget evidence: `/app` renders the insufficient overall card ("Based on 1 of 8 systems") with the non-diagnostic disclaimer, and with a queued job shows **Assessment update available** plus the "remains visible while a newer update is prepared" copy inside the widget. The scored compact variant was not visually exercised because this fixture legitimately has no overall score (1 of 8 systems); both variants share the same `LifecycleNotice` component verified above.

## Out of scope or not manually testable yet

- The checklist does not validate diagnoses, disease risk, treatment recommendations, clinical urgency, or the medical correctness of reference ranges.
- Registry catalog, alias, resolver, unit, observation projection, assessment binding, persistence, and worker/RPC formula changes are out of scope for EH-146; existing EH-143/EH-145 evidence remains authoritative (EH-123 DB test re-run green in this environment).
- Cross-profile ownership, RLS, and signed-file authorization require a dedicated multi-profile database fixture; only the service-role access contract was re-verified here.
- A real end-to-end document upload through OCR/extraction (LLM-dependent) was not exercised; synthetic observations were seeded at the database boundary and everything downstream (snapshot, scoring, versioning, lifecycle, UI) ran for real.
