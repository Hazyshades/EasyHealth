# EH-148: Doctor Visit Brief

**Roadmap status:** In progress
**Build / environment:** `local Supabase (Docker Desktop), pnpm dev, OpenAI report stage`
**Test run date:** `2026-10-01`
**Tester:** `________`

## What this checklist covers

This checklist covers the source-grounded Doctor Visit Brief: typed sections, explicit limitations, source references, and the materialized document scope. It does not treat a filename or an LLM sentence as evidence by itself.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID                        | Test document or setup                                                                                                                                                                   | Purpose                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `EH148-LAB-01`            | Synthetic lab with two dated numeric observations and ranges                                                                                                                             | Normal evidence path                                    |
| `EH148-MIXED-01`          | Synthetic imaging/consultation document with accepted structured fields                                                                                                                  | Multi-source scope                                      |
| `EH148-LIMIT-01`          | Synthetic document with one point or no comparable history                                                                                                                               | Missing-evidence path                                   |
| `EH148-LEGACY-01`         | Existing test fixture representing an unversioned legacy report                                                                                                                          | Legacy boundary                                         |
| `EH148-SAFETY-01`         | Validator fixture containing model-authored factual text, unknown template/parameter, removed claim, diagnosis, treatment, urgency, imperative, and unsupported free-form factual fields | Content-safety boundary                                 |
| `EH148-ARCHIVE-01`        | Published brief whose cited source row is archived/removed while its parent document remains active                                                                                      | Read-time source-unavailable limitation                 |
| `EH148-DYNAMICS-SCOPE-01` | Report request with `biomarker_dynamics_period` and one selected document while another owned eligible document remains unselected                                                       | Scope-constrained frozen dynamics                       |
| `EH148-RANGE-01`          | Synthetic documents on both report-date boundaries, including a source timestamp late on the end date, outside the range, and without an authoritative date                              | Inclusive date-scope filtering                          |
| `EH148-QUESTIONS-01`      | Owner-safe report request using `EH148-RANGE-01` plus two valid questions and one invalid control-character/overlong question variant                                                    | Question normalization/origin and pre-persist rejection |
| `EH148-TOMBSTONE-01`      | Published brief whose source document is tombstoned during read or between context capture and persistence                                                                               | Whole-report invalidation and writer fencing            |

## Interface checks

### EH148-UI-01: Create a mixed-source brief

**Precondition:** The dedicated account has `EH148-LAB-01` and `EH148-MIXED-01` eligible for reports.

1. Go to **Reports → Create report**.
2. Select both synthetic documents and create a standard brief.
3. Open the generated report detail page.

**Expected result:** The brief shows typed document summaries, latest measurements, changes, questions, limitations, and a visible disclaimer. Each factual item has an inspectable source reference; no unrelated document appears.

**Result:** `PASS`
**Notes / evidence link:** Executed 2026-10-01 in Chromium against `http://localhost:3000`. `EH148-MIXED-01` only: the detail page rendered Overview, Document summary with two source-referenced items, Questions, Limitations, Source ledger, and the educational disclaimer. Latest measurements and Changes over time stayed empty because the seeded observations are not registry-resolved; see the developer evidence note.

### EH148-UI-02: Show missing evidence as a limitation

**Precondition:** The account has only `EH148-LIMIT-01` in scope.

1. Create a brief from the limited fixture.
2. Open the report detail page.
3. Inspect the changes and limitations sections.

**Expected result:** The page explains that a comparison is unavailable. It does not label the result as improving, worsening, diagnosed, or treated.

**Result:** `PASS`
**Notes / evidence link:** The generated brief shows "The selected documents do not contain enough dated history for a change comparison." and no improving/worsening/diagnosed/treated wording anywhere on the page.

### EH148-UI-03: Inspect the source ledger

**Precondition:** A validated brief exists with `EH148-LAB-01` in scope.

1. Open the source details for a measurement claim.
2. Compare the displayed value, unit, reference range, date, and document label with the synthetic source.
3. Inspect the visible source ledger and citation labels.

**Expected result:** The ledger shows the evidence snapshot and document identity, and citation labels are derived from source IDs rather than filenames.

**Result:** `PASS`
**Notes / evidence link:** The Source ledger lists both catalog sources with opaque `src_...` ids, their document labels, and their source dates; every factual line shows a `Sources:` line built from those ids, never from a filename alone.

### EH148-UI-04: Keep legacy reports readable without fabricated citations

**Precondition:** `EH148-LEGACY-01` is visible to the dedicated account.

1. Open the legacy report.
2. Confirm the existing content remains readable.
3. Look for sharing and export actions.

**Expected result:** Legacy content is identified as legacy. Source-grounded sharing/export is unavailable until revalidation; no citation markers are invented from old filenames.

**Result:** `N/A`
**Notes / evidence link:** No legacy row exists in the local database, so the legacy presentation state was not exercised in the UI. The resolver contract remains covered by `pnpm test:eh148-contract`.

### EH148-UI-05: Preserve questions and date-filtered scope

**Precondition:** `EH148-RANGE-01` and `EH148-QUESTIONS-01` are eligible for the dedicated account, and the report form exposes the reviewed question/date controls.

1. Set an inclusive report date range containing the boundary fixtures.
2. Enter two valid user-selected questions and create the brief.
3. Open the report detail and inspect its source ledger and questions section.

**Expected result:** Boundary documents are included, outside-range and undated documents are absent, and each submitted question is visibly rendered as a question without a factual answer or invented citation.

**Result:** `PASS`
**Notes / evidence link:** Executed 2026-10-02 with report date range 2026-09-01 → 2026-09-30 and two typed questions. Both boundary documents stayed in scope, and both questions rendered as "Selected by you" questions with no answer and no citation. Reversing the range shows "The start date must not be after the end date." and disables **Create report**.

## Developer evidence required

- [x] Contract/schema verification: `pnpm test:eh148-contract` proves canonical six section containers use typed claim/limitation/source references, every non-removed claim/source/limitation is referenced exactly once, claim `section` matches its container, incompatible kinds fail closed, and empty sections carry explicit allowed states.
- [x] API verification proves the all-eligible request stores an exact document UUID array and cannot widen explicit scope. The route service captures the materialized source set and the EH-148 RPC rechecks it.
- [x] Mixed-source verification: `pnpm test:eh148-contract` covers observations, findings, clinical notes, prescriptions, referrals, and document summaries through the server-owned projection.
- [ ] Legacy verification proves unversioned/null-scope rows are readable but not silently upgraded. _(Evidence provider: EH-148 report-surface owner.)_
- [x] The EH-150 validator handoff is present in `src/lib/report-generation.ts`; the service now adapts its sanitized content into the EH-148 contract before calling structured persistence.
- [x] Focused API/route verification: `pnpm test:eh148-contract` asserts the route delegates to `createValidatedReport`, and `pnpm test:eh148-db` proves the persisted envelope and ledger contain no storage path and no cross-profile source row.
- [x] Service-transition evidence: `pnpm test:eh148-db` (27 pgTAP assertions on the local stack) accepts the exact payload the service sends, then proves generation drift, wider requested scope, tombstoned source, incomplete evidence mapping, non-publishable status, tampered envelope, rewritten source snapshot, and cross-section claim reference are all rejected with no report, mapping, or readable candidate left behind; `service_role` still cannot insert into `reports` directly, `authenticated` cannot call the RPC, and owner delete cascades the mappings.
- [x] Section-contract evidence: `pnpm test:eh148-contract` verifies canonical section order, claim-kind compatibility, unknown and duplicate references, and explicit empty states with machine limitations.
- [x] Adversarial content verification: `pnpm test:eh148-contract` proves prohibited model-authored factual text and imperative generated questions fail closed while `clinician_question` remains non-factual.
- [ ] Archive/remove-after-publication verification proves owner, share, and export reads use the EH-148 resolver, preserve the historical snapshot only while the parent document remains active, add `SOURCE_UNAVAILABLE`, and deny live/raw-source access without rewriting the persisted payload. _(Evidence provider: EH-148 read-resolver owner; EH-151 public-read owner; EH-153 export owner.)_
- [x] Dynamics handoff evidence proves `biomarker_dynamics_period`, exact materialized document scope, and no client DTO/raw observations reach EH-149; the service passes only the frozen extension returned by the server adapter.
- [x] Validation-envelope evidence proves new reports pass only the EH-150 status/version/issue-code envelope into `public.create_validated_report`; `pnpm test:eh148-contract` and `pnpm test:eh150` pass.
- [x] API/UI verification proves valid user-selected questions are normalized before generation and rendered server-side with `origin: user_selected`; invalid forms fail before persistence.
- [x] Report-date evidence proves inclusive UTC boundary parsing and service-side filtering; explicit scope is rejected when filtering removes a requested document.
- [x] Tombstone/race evidence: `pnpm test:eh148-db` proves `request_document_deletion` on a cited source both blocks the next validated write and invalidates the published report, and that a captured `write_generation` drift is rejected at commit time. `pnpm test:eh104-durable-deletion-db` (36 assertions) passes on the same stack.

## Automated regression coverage

- [x] `pnpm test:eh148-contract` verifies the canonical section order, typed claim/source/limitation references, opaque source projection for all six source kinds, bounded questions, inclusive UTC end-date handling, deterministic candidate rendering with user-selected question origin, rejection of model-authored factual text and imperative generated question text, rejection of an unknown citation, and server-owned candidate assembly (hostile selections add no factual claim beyond catalog coverage). _(Executed 2026-10-01; passed.)_
- [x] `pnpm exec tsc --noEmit --pretty false`, `pnpm test:eh149`, `pnpm test:eh150`, `pnpm test:eh104`, `pnpm test:eh148-db`, `pnpm test:writer-seam`, `pnpm test:eh104-durable-deletion-db`, `pnpm test:service-role-access-db`, the five PR2 database contracts, `pnpm check:postgrest-embed-hints`, `pnpm check:ci-suite-coverage`, and `supabase db lint` (0 errors) passed on the local stack. _(Executed 2026-10-01.)_

## Local verification record

- `pnpm exec tsc --noEmit --pretty false` passed after the contract, safety-policy, resolver, and typed-renderer changes.
- `pnpm test:eh104` passed the durable writer/document-delete boundary checks.
- `pnpm test:eh148-contract` passed after updating the fixture to use a valid-shaped unknown source ID.
- `pnpm exec supabase db lint --local` reports 0 errors and 21 pre-existing warnings, none in EH-148 functions; migration 083 applies cleanly to the local stack.
- The generation seam is server-owned: the model returns only a selection, `src/lib/report-candidate.ts` builds the validator envelope, and `pnpm test:eh148-db` sends that exact payload through the real RPC.
- Fixture limitation: the local smoke observations are not registry-resolved (`incomplete_resolution`), so `Latest measurements` and `Changes over time` stayed empty in the UI run. The numeric path is covered by the contract verifier and by the pgTAP fixture, which includes `numeric_observation` claims; producing registry-resolved local fixtures needs the Registry writer fixtures owned outside EH-148.
- `pnpm preflight:document-deletion` still reports the repository's live-target and worker-dependency blockers and is not treated as a pass.

## Out of scope or not manually testable yet

- Citation semantics, token verification, access logs, and export format fidelity are covered by EH-150, EH-151/EH-152, and EH-153.
- Legacy-row presentation (`EH148-UI-04`) still needs a legacy fixture row; the resolver contract itself is covered by `pnpm test:eh148-contract`.
