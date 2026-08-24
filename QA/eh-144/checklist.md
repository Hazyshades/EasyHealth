# EH-144: Versioned Health Profile freshness policy

**Roadmap status:** In progress  
**Build / environment:** `Local Next.js app with local Supabase and local document worker`  
**Test run date:** `2026-08-24` (full run; earlier partial smoke 2026-08-23)  
**Tester:** `Codex local verification`

## What this checklist covers

This checklist verifies that Health Profile current-state scoring distinguishes current, outdated, and undated observations. It also verifies that the user-facing explanation describes the evidence state without telling the user to order tests.

The policy is a technical assessment boundary, not a clinical monitoring interval or a diagnosis. The current implementation uses the versioned `eh-144.v1` policy with a 365-calendar-day maximum age for the eight named body systems.

## Before you start

- [x] Use a dedicated disposable test account.
- [x] Use only synthetic or de-identified documents; do not upload patient data.
- [x] Use synthetic lab documents whose collection date is explicit, older than one year, or absent as required by each test.
- [x] Confirm each document has finished processing and any extracted biomarker rows are available in **Documents** before opening **Health Profile** — fixtures were inserted as ready synthetic rows through the canonical normalization write path; the document-review screen was opened for the unknown-date fixture and rendered the rows without a fabricated date.
- [x] Keep the synthetic collection dates and filenames recorded with the test evidence.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH144-CURRENT` | Synthetic lipid panel dated within the last 365 calendar days, containing LDL, HDL, and triglycerides with ordinary numeric values and lab reference ranges | Current evidence and scoreable system |
| `EH144-OUTDATED` | Synthetic lipid panel dated more than 365 calendar days before the test date, containing the same three markers and reference ranges | Outdated evidence must not unlock a current-state score |
| `EH144-UNKNOWN-DATE` | Synthetic lipid panel with the collection date omitted or not parseable, containing the same three markers | Unknown date must remain distinct from outdated evidence |
| `EH144-ALTERNATIVE` | Synthetic lipid panel with non-HDL cholesterol, HDL, and triglycerides, dated within the policy window | A current alternative readiness group remains usable |

## Interface checks

### EH144-UI-01: Current observations render as current evidence

**Precondition:** `EH144-CURRENT` has finished processing and its three biomarkers are visible in **Documents**.

1. Open **Health Profile** for the disposable account.
2. Locate the **Cardiovascular** body-system badge.
3. Open the **Cardiovascular** system details.
4. Review the marker details and observed date.

**Expected result:** The Cardiovascular system has a numeric score when all required groups are satisfied. Each marker shows its observed date and a current-under-policy freshness label. No text instructs the user to order a test.

**Result:** `PASS`  
**Notes / evidence link:** Full run 2026-08-24 with disposable account `EH144 C.` and `EH144-CURRENT.pdf` (observed 2026-08-20). `/api/health-profile` returned `cardiovascular.state_score=95`, `scoreability=scoreable`, all required groups `satisfied`, marker `freshness_status=current`, unit conversion mg/dL→mmol/L, and the saved worker-computed assessment version (`assessment.version_id` set, `fallback=false`, `freshness_policy_version=eh-144.v1`). Drawer showed **95/100**, "Current under this assessment policy", "Observed 2026-08-20", and no order-test wording. Fixture rows were removed after the run.

### EH144-UI-02: Outdated evidence is not treated as missing evidence

**Precondition:** Process `EH144-OUTDATED` after removing or isolating the current fixture so the outdated observations are the latest usable rows for the account.

1. Open **Health Profile**.
2. Select the **Cardiovascular** body-system badge.
3. Read the system state explanation and the marker details.
4. Check the body-map badge and the system details for a score.

**Expected result:** The Cardiovascular system has no numeric current-state score and is labeled **Not scored - outdated data**. The observations remain visible with their source date and an outdated-under-policy explanation. The page does not say to order, repeat, or obtain a test.

**Result:** `PASS`  
**Notes / evidence link:** Full run 2026-08-24 with disposable account `EH144 O.` and `EH144-OUTDATED.pdf` (observed 2025-01-01). `/api/health-profile` returned no score, all groups `outdated`, marker `freshness_status=outdated`, and the saved assessment version with `eh-144.v1`. Body-map badge read "Heart: outdated evidence"; drawer showed **Not scored - outdated data**, "Outdated under this assessment policy", "Observed 2025-01-01", and no order/retest wording. Fixture rows were removed after the run.

### EH144-UI-03: Missing medical date is distinct from outdated evidence

**Precondition:** Process `EH144-UNKNOWN-DATE` after isolating the dated fixtures from the account.

1. Open **Health Profile**.
2. Select the **Cardiovascular** body-system badge.
3. Review the system explanation and each marker's observed-date line.
4. Compare the result with `EH144-OUTDATED`.

**Expected result:** The Cardiovascular system has no numeric score because the medical date cannot be evaluated. The UI shows **date unavailable** / **Observed date unavailable** rather than classifying the observation as outdated. The explanation remains factual and does not instruct the user to order a test.

**Result:** `PASS`  
**Notes / evidence link:** Full run 2026-08-24 with disposable account `EH144 U.` and `EH144-UNKNOWN-DATE.pdf` (no collection date). `/api/health-profile` returned no score, all groups `unknown_date` (not `outdated`), marker `freshness_status=unknown_date` with `observed_at=null`, and values preserved. Body-map badge read "Heart: medical date unavailable"; drawer showed **Not scored - date unavailable** with "A required observation has no available medical date, so its currentness cannot be evaluated." Marker rows render "Observed date unavailable" (duplicated line recorded as papercut pc_6f2bb4dffb32). No order-test wording. Fixture rows were removed after the run.

### EH144-UI-04: Current alternative readiness remains usable

**Precondition:** Process `EH144-ALTERNATIVE` and isolate it from the other lipid fixtures.

1. Open **Health Profile**.
2. Select **Cardiovascular**.
3. Review the contributing marker list and score.

**Expected result:** Non-HDL cholesterol satisfies the alternative atherogenic-cholesterol readiness group. With current HDL and triglycerides, Cardiovascular remains scoreable; LDL is not incorrectly required when the configured alternative is present.

**Result:** `PASS`  
**Notes / evidence link:** Full run 2026-08-24 with disposable account `EH144 A.` and `EH144-ALTERNATIVE.pdf` (non-HDL cholesterol, HDL, triglycerides; observed 2026-08-20). `/api/health-profile` returned `state_score=95`, `scoreability=scoreable`, group `[ldl, non_hdl_cholesterol]` satisfied by `non_hdl_cholesterol`, all markers `freshness_status=current`, saved version with `eh-144.v1`. Drawer showed the score and the non-HDL marker without an LDL requirement. Fixture rows were removed after the run.

### EH144-UI-05: Existing source and navigation views remain safe

**Precondition:** At least one of the fixtures has finished processing.

1. Open **Documents** and open the source document used by the Health Profile marker.
2. Confirm the source document and measurement-history links still open.
3. Return to **Health Profile** using the provided navigation.
4. Repeat with an account containing `EH144-UNKNOWN-DATE` if the source date is not available.

**Expected result:** Source links and return navigation work. A missing date renders as an unavailable date, not as the upload time or another fabricated medical date. Existing document-review content remains unchanged apart from the explicit freshness explanation.

**Result:** `PASS`  
**Notes / evidence link:** Full run 2026-08-24 on the `EH144 U.` account. "Open source document" opened the document-review screen for `EH144-UNKNOWN-DATE.pdf` with no fabricated medical date; measurement-history links carried `system`/`measurement`/`returnTo` parameters; the provided **Health Profile** return link reopened the profile with the body map and the correct badge. Fixture rows were removed after the run.

**Run scope note (2026-08-24):** Full run executed UI-01 through UI-05 plus the saved-version API evidence item. All interface checks passed; no checks remain unexecuted.

## Developer evidence required

These contracts are not manually testable through the product interface and require automated evidence from the implementer or CI owner:

- [x] `pnpm test:eh144` proves policy version `eh-144.v1`, calendar-day freshness boundaries, current/outdated/unknown-date classification, score exclusion, alternative readiness, deterministic latest-row selection, snapshot hash variation, route metadata, source-date fallback, and non-order copy.
- [x] `pnpm test:eh144-db` proves the assessment-version column/default, five-argument completion RPC, explicit/default policy stamping, payload/row agreement validation, and append-only version rows.
- [x] `pnpm typecheck` proves the Health Profile API, worker completion call, body map, drawer, and projection types compile together.
- [x] `pnpm check:ci-suite-coverage && pnpm check:ci-suite-coverage-contract` proves both EH-144 suites are reachable from the `verify` and `database` jobs.
- [x] Migration evidence proves `supabase/migrations/074_eh144_versioned_freshness_policy.sql` was applied before the database contract ran in the local target environment.
- [x] API evidence proves `/api/health-profile` returns `assessment.freshness_policy_version` and `assessment.freshness_evaluated_at` for both a saved version and deterministic fallback — 2026-08-24 full run served worker-computed saved versions for all four disposable accounts (`assessment.version_id` set, `fallback=false`, policy `eh-144.v1`, `freshness_evaluated_at` stamped); deterministic fallback metadata was observed in the 2026-08-23 smoke before saved versions existed.
- [x] Static accessibility contract evidence verifies the body-map badge names distinguish outdated evidence, unavailable medical dates, and generic unavailable assessments.

## Out of scope or not manually testable yet

- The UI does not expose policy administration, policy version editing, or a date override control. Those are not part of EH-144; verify policy changes through source, migration, and automated evidence only.
- This change does not recommend a clinical retest interval, diagnose disease, or generate patient-specific medical advice. Do not add a test step that asks a user to order or repeat a test.
- Remote Wiki publication is not a product-interface check; its status belongs in the Registry documentation tracking issue and must not be marked complete from a local render alone.
