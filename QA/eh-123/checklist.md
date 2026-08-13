# EH-123: Recalculate dependent Health Profile assessments

**Roadmap status:** In progress
**Build / environment:** Local Next.js app with linked Supabase project `nuqvypxavtorupntmrau`; remote EH-123 migrations `053`–`057` applied on 2026-08-13
**Test run date:** 2026-08-13
**Tester:** Automated contract run; authenticated disposable-account smoke run; correction dataset and controlled-failure scenarios pending

## What this checklist covers

This checklist covers the user-facing Health Profile behavior after a reviewed laboratory result changes. A correction, verification update, or applied reprocess must not leave the user with an unacknowledged stale assessment; the page shows the latest completed assessment or a clear update/failure state.

Charts remain based on the current accepted laboratory results. They are not separate stored assessments and should reflect a saved correction on reload.

## Before you start

- [x] Use a disposable test account; the account was deleted after the smoke run.
- [x] Use only synthetic or de-identified data; no patient document was uploaded in this smoke run.
- [ ] Confirm the listed documents have finished processing.
- [x] Confirm the account can open **Documents**, **Biomarkers**, and **Health Profile**.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH123-01` | Synthetic laboratory report with reviewed, score-eligible glucose and lipid results. | Baseline Health Profile and correction/recalculation path. |
| `EH123-02` | Synthetic report with a safe, known correction that changes a value or accepted measurement mapping. | Downstream update and chart regression. |
| `EH123-03` | Same account with a deliberately controlled worker failure in a non-production test environment. | Retry and last-known-good assessment behavior. |

## Interface checks

### EH123-UI-01: Correction updates the dependent assessment

**Precondition:** `EH123-01` has a completed Health Profile assessment. Record the displayed overall score and completion time without recording patient data.

1. Go to **Documents** and open the processed synthetic report `EH123-02`.
2. In **Extracted biomarkers**, save the prepared valid correction with its reason.
3. Go to **Health Profile** and reload the page.
4. Wait for the displayed assessment update state to finish, then record the new visible completion time and score if it changed.
5. Open **Biomarkers** and confirm the corrected row and chart/trend eligibility match the saved current result.

**Expected result:** The page does not silently keep an unacknowledged stale assessment. It shows an updating state until a new assessment is available, then shows the new completed version. Biomarkers reflect the current saved result; the correction never exposes raw source edits as a separate chart series.

**Result:** `Blocked`
**Notes / evidence link:** The disposable authenticated smoke account had no `EH123-01`/`EH123-02` laboratory documents, so the correction transition could not be exercised. Authenticated `GET /api/health-profile` and `GET /api/biomarkers` returned `200` with `Cache-Control: no-store`; the full correction scenario still requires the prepared synthetic documents.

### EH123-UI-02: Stale synthesis stays visible until explicitly refreshed

**Precondition:** The profile has a displayed holistic synthesis created before the correction in `EH123-UI-01`.

1. Go to **Health Profile** after the correction is saved.
2. Confirm the existing synthesis is visible and marked as needing an update.
3. Click **Refresh synthesis** once.
4. Wait for the request to finish and reload the page.

**Expected result:** The existing synthesis remains visible until the refresh succeeds. One successful refresh replaces the current displayed synthesis with a current version and removes the update notice. Reloading the page does not trigger another automatic refresh.

**Result:** `Blocked`
**Notes / evidence link:** The disposable authenticated smoke account had no completed baseline synthesis, so stale-synthesis retention and explicit refresh could not be exercised. The authenticated `POST /api/health-profile/synthesis` correctly returned `400` (`No structured documents available for synthesis`) without changing data.

### EH123-UI-03: Failed recalculation is visible and retryable

**Precondition:** Use only `EH123-03` in an isolated non-production environment where the test owner can safely make the assessment worker fail once.

1. Save the prepared valid correction from **Documents**.
2. Go to **Health Profile** and reload.
3. Observe the update failure state and the previously completed assessment, if one exists.
4. Restore the worker dependency and use the offered retry control once.
5. Reload **Health Profile** after the retry completes.

**Expected result:** A failed update does not erase the previous completed assessment. The page identifies the failure and allows a retry. The retried update completes once and the page returns to a completed state.

**Result:** `Blocked`
**Notes / evidence link:** No isolated worker-failure environment was available, and the disposable smoke account had no recalculation input. Keep this scenario blocked; use the automated failure/retry contract evidence below rather than running a controlled failure against shared data.

## Developer evidence required

- [x] `supabase db reset --local` applied migrations `001`–`057`, then `pnpm test:eh123-db` passed 20 assertions: live-event admission, backfill exclusion, privacy boundary, exclusive claim, invalid snapshot rejection, immutable version write, one receipt, retryable lease recovery, and manual retry. Owner: backend engineer.
- [x] `pnpm test:eh123` passed the Registry V2 Health Profile input gate, deterministic canonical snapshot ordering/hash, version selection, no-store API responses, retry route, worker claim/complete/failure/reclaim seams, and no-GET synthesis contract. `pnpm typecheck` and `npx tsc --noEmit -p worker/tsconfig.json` also passed. Owner: backend engineer.
- [x] Disposable-database CI is configured to run `pnpm test:eh123-db` after migrations in `.github/workflows/measurement-registry.yml`. This local run does not claim a remote CI result. Owner: CI.
- [x] Schema review and the pgTAP privacy assertion confirm dependency events declare no raw patient values, document text, source regions, resolver evidence, or decision traces. Owner: backend engineer.
- [x] The database contract verifies immutable version/receipt writes and append-only dependency-event mutation rejection. The EH-121 regression (`37` assertions) also passed after EH-123 preserves controlled lineage-purge cascades. Owner: database contract test.
- [x] `supabase db push --linked --yes` applied the five pending remote migrations `053_eh123_assessment_recalculation.sql` through `057_eh123_allow_lineage_purge.sql`. A read-only PostgREST probe changed from `404 PGRST205` (table absent) to `401 42501` (table present but service-role-only), confirming the schema is published. Owner: backend engineer.
- [x] Authenticated disposable-account smoke after the remote repair: profile and consent onboarding completed; **Documents**, **Biomarkers**, and **Health Profile** opened successfully; `GET /api/health-profile` and `GET /api/biomarkers` returned `200` with `Cache-Control: no-store`; two `POST /api/health-profile/recalculate` calls returned `200` with `{ "status": "queued" }` and `Cache-Control: no-store`; `POST /api/health-profile/synthesis` returned the expected `400` no-documents response. The disposable account was removed after the run. Owner: backend engineer.

## Out of scope or not manually testable yet

- EH-120 verification transition rules and EH-122 bulk verification selection/undo remain out of scope. EH-123 consumes their committed EH-121 events without changing their workflow semantics.
- A tester cannot prove transactional event admission, worker race exclusion, lease recovery, version immutability, or event receipts through the product UI; the developer evidence above is required.
- Do not run the controlled-failure scenario on production or shared user data. If no isolated worker-failure environment is available, mark `EH123-UI-03` **Blocked** and attach the automated contract evidence instead.

- [x] Unauthenticated smoke checks against `GET /api/health-profile` and `POST /api/health-profile/recalculate` returned `401 Unauthorized` with `Cache-Control: no-store`. Authenticated disposable-account route and page smoke also passed after the remote migration repair; the document correction, stale synthesis, and controlled-failure scenarios remain explicitly blocked for the reasons above.