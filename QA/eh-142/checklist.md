# EH-142: Enforce resolved, verified range and value eligibility

**Roadmap status:** In progress
**Build / environment:** `Next.js 15.5.8 on http://localhost:3001; Supabase local Docker stack; Mailpit magic-link auth`
**Test run date:** `2026-08-23`
**Tester:** `OpenAI Codex agent`

## What this checklist covers

EH-142 keeps every source laboratory result visible while limiting Health Profile assessment to verified, numeric results with a reviewed measurement, approved assessment binding, and a usable range printed in the source document. In **Biomarkers**, an excluded result must say why it is not used in assessment without suggesting the laboratory result is wrong.

## Before you start

- [x] Use a dedicated synthetic test account (`eh142-ui-20260823-0738@example.test`).
- [x] Use only synthetic or de-identified documents; no patient data was uploaded.
- [x] Confirm the fixture observations are visible in **Biomarkers** and linked to their source documents.
- [x] Record the build identifier and tester above before marking a result.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH142-UI-01` | Synthetic verified numeric glucose result with source text `70–99`, numeric value `90`, and reviewed glucose binding. | Eligible baseline. |
| `EH142-UI-02` | Synthetic accepted qualitative laboratory result with raw value text such as `positive`, a reviewed concrete definition, and a linked source document. | Qualitative exclusion copy. |
| `EH142-UI-03` | Synthetic accepted numeric laboratory result whose source document has no reference range. | Missing source-range exclusion copy. |
| `EH142-DEV-01` | Seeded/reversed verified observation in a disposable environment with `verification_status = pending`. | Verification gate; developer-only unless an approved product control exposes it. |

## Interface checks

### EH142-UI-01: Eligible source-backed numeric result remains understandable

**Precondition:** `EH142-UI-01` is visible in **Biomarkers** for the dedicated test account.

1. Open **Biomarkers**.
2. Find the synthetic glucose result.
3. Confirm the displayed value and reference range match the fixture.
4. Open the linked source document from the result row.

**Expected result:** The result remains visible, shows its source value and range, and does not show an assessment-exclusion message. The source link opens the matching synthetic document.

**Result:** `Pass`
**Notes / evidence link:** `http://localhost:3001/app/biomarkers?measurement=glucose_serum` showed `5 mmol/L`, original `90 mg/dL`, native `3.89 – 5.49` (70–99 mg/dL), no exclusion copy; the source link opened `EH142-eligible-glucose.pdf` in Document review.

### EH142-UI-02: Qualitative result remains visible with safe assessment guidance

**Precondition:** `EH142-UI-02` is visible in **Biomarkers** for the dedicated test account.

1. Open **Biomarkers**.
2. Find the qualitative result.
3. Read the result status and the assessment guidance beneath it.
4. Open the linked source document.

**Expected result:** The raw qualitative result remains visible. The guidance explains that it is not used in numeric assessment because it is qualitative. It must not say that the laboratory result is invalid, erroneous, or rejected.

**Result:** `Pass`
**Notes / evidence link:** The Biomarkers row retained raw `positive` and showed `Not used in assessment: This result is qualitative, so it is not used in numeric assessment.` The source link opened `EH142-qualitative-result.pdf`; no invalid/erroneous/rejected wording appeared.

### EH142-UI-03: Missing source range does not get replaced

**Precondition:** `EH142-UI-03` is visible in **Biomarkers** for the dedicated test account.

1. Open **Biomarkers**.
2. Find the numeric result without a source reference range.
3. Read the assessment guidance and open the linked source document.

**Expected result:** The source result remains visible. The guidance says the source document has no usable reference range for assessment. No Registry, population, or generic replacement range is displayed.

**Result:** `Pass`
**Notes / evidence link:** The Biomarkers row retained `90 mg/dL`, displayed `—` for reference, and showed `Not used in assessment: The source document has no usable reference range for this result.` No replacement Registry, population, or generic range appeared.

## Developer evidence required

- [x] `pnpm test:eh142` — passed locally on 2026-08-23. Proves deterministic eligibility reasons for verified statuses, incomplete outcomes, provisional definitions, unapproved bindings, qualitative/missing/invalid values, missing/inverted ranges, one-sided ranges, Health Profile omission, and non-invalidating labels.
- [x] `pnpm exec tsx scripts/verify-health-profile-lab-input.ts` — passed locally on 2026-08-23. Proves the shared Health Profile input projector excludes qualitative and range-ineligible observations.
- [x] `pnpm test:eh142-db` — passed locally on 2026-08-23 against the Supabase Docker stack: 8/8 pgTAP assertions. Proves EH-142 requeues non-processing laboratory profiles, preserves an in-flight job, marks synthesis stale, and preserves append-only assessment versions.
- [x] `pnpm typecheck` — passed locally on 2026-08-23. Proves TypeScript contracts for the API, table, predicate, and snapshot query.
- [x] `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` — passed locally on 2026-08-23. Proves generated canonical documentation is current and structurally valid.
- [x] `openspec validate eh-142-enforce-resolved-verified-range-and-value --strict` — passed locally on 2026-08-23.

- [x] Browser/API smoke — `GET /api/biomarkers` returned `200` with `Cache-Control: no-store`; eligible glucose had `assessment_eligible=true`, qualitative had `non_numeric_value`, and missing-range numeric had `missing_document_reference_range`.
- [x] Health Profile projection smoke — `GET /api/health-profile` returned `200` with `Cache-Control: no-store`; qualitative and missing-range fixture names were absent from the assessment payload while the eligible glucose remained present.

## Out of scope or not manually testable yet

- EH-141 clinical approval of score-required groups, Registry definitions, approved bindings, and scoring formulas are unchanged.
- Pending verification and exact machine exclusion-code precedence are not manually testable without a provisioned developer fixture or an approved verification-reversal interface. Use `EH142-DEV-01` and the automated `test:eh142` evidence; do not mark a manual result as passed without that fixture.
- The migration and immutable assessment-version history are database-only. The 8/8 pgTAP contract passed against the local Supabase Docker stack; never exercise these writes against production or shared patient data.
