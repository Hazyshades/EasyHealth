# EH-148: Doctor Visit Brief

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
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

**Result:** `N/A`
**Notes / evidence link:** `N/A`: runtime UI execution is blocked because the EH-148 generation route remains fail-closed pending EH-150 validator and structured-persistence integration, plus unavailable local Supabase/OpenAI environment.

### EH148-UI-02: Show missing evidence as a limitation

**Precondition:** The account has only `EH148-LIMIT-01` in scope.

1. Create a brief from the limited fixture.
2. Open the report detail page.
3. Inspect the changes and limitations sections.

**Expected result:** The page explains that a comparison is unavailable. It does not label the result as improving, worsening, diagnosed, or treated.

**Result:** `N/A`
**Notes / evidence link:** `N/A`: runtime UI execution is blocked because the EH-148 generation route remains fail-closed pending EH-150 validator and structured-persistence integration, plus unavailable local Supabase/OpenAI environment.

### EH148-UI-03: Inspect the source ledger

**Precondition:** A validated brief exists with `EH148-LAB-01` in scope.

1. Open the source details for a measurement claim.
2. Compare the displayed value, unit, reference range, date, and document label with the synthetic source.
3. Inspect the visible source ledger and citation labels.

**Expected result:** The ledger shows the evidence snapshot and document identity, and citation labels are derived from source IDs rather than filenames.

**Result:** `N/A`
**Notes / evidence link:** `N/A`: runtime UI execution is blocked because the EH-148 generation route remains fail-closed pending EH-150 validator and structured-persistence integration, plus unavailable local Supabase/OpenAI environment.

### EH148-UI-04: Keep legacy reports readable without fabricated citations

**Precondition:** `EH148-LEGACY-01` is visible to the dedicated account.

1. Open the legacy report.
2. Confirm the existing content remains readable.
3. Look for sharing and export actions.

**Expected result:** Legacy content is identified as legacy. Source-grounded sharing/export is unavailable until revalidation; no citation markers are invented from old filenames.

**Result:** `N/A`
**Notes / evidence link:** `N/A`: runtime UI execution is blocked because the EH-148 generation route remains fail-closed pending EH-150 validator and structured-persistence integration, plus unavailable local Supabase/OpenAI environment.

### EH148-UI-05: Preserve questions and date-filtered scope

**Precondition:** `EH148-RANGE-01` and `EH148-QUESTIONS-01` are eligible for the dedicated account, and the report form exposes the reviewed question/date controls.

1. Set an inclusive report date range containing the boundary fixtures.
2. Enter two valid user-selected questions and create the brief.
3. Open the report detail and inspect its source ledger and questions section.

**Expected result:** Boundary documents are included, outside-range and undated documents are absent, and each submitted question is visibly rendered as a question without a factual answer or invented citation.

**Result:** `N/A`
**Notes / evidence link:** `N/A`: runtime UI execution is blocked because the EH-148 generation route remains fail-closed pending EH-150 validator and structured-persistence integration, plus unavailable local Supabase/OpenAI environment.

## Developer evidence required

- [ ] Contract/schema verification proves canonical six section containers use typed claim/limitation/source references, every non-removed claim/source/limitation is referenced exactly once, claim `section` matches its container, incompatible kinds fail closed, and empty sections carry explicit allowed states. _(Evidence provider: EH-148 contract owner; EH-150 validator owner; EH-153 serializer owner.)_
- [ ] API verification proves the all-eligible request stores an exact document UUID array and cannot widen explicit scope. _(Evidence provider: EH-148 persistence owner.)_
- [ ] Mixed-source verification covers observations, findings, notes, prescriptions/referrals, and document summaries. _(Evidence provider: EH-148 source-projection owner.)_
- [ ] Legacy verification proves unversioned/null-scope rows are readable but not silently upgraded. _(Evidence provider: EH-148 report-surface owner.)_
- [ ] The EH-150 validator handoff is present, but the EH-148 integration seam and structured persistence transition remain to be recorded before share/export work begins. _(Evidence provider: EH-148 and EH-150 owners.)_
- [ ] Focused API/route verification proves storage paths and cross-profile source rows never enter the report response or source ledger. _(Evidence provider: EH-148 route owner; EH-150 validator owner.)_
- [ ] Service-transition evidence proves `public.create_validated_report` rechecks identity/scope and rolls back staged report/mapping/status on injected validator, RPC, and persistence failure with no readable unvalidated candidate; direct report/evidence table DML is denied to runtime roles and owner report deletion uses the durable `public.delete_owner_report` transition. _(Evidence provider: EH-148 RPC owner; durable-deletion owner; EH-150 validator owner.)_
- [ ] Section-contract evidence proves the canonical six section containers/order, claim-kind compatibility, unknown/missing/duplicate rejection, and explicit allowed empty states with machine limitations. _(Evidence provider: EH-148 contract owner; EH-150 validator owner; EH-153 serializer owner.)_
- [ ] Adversarial content verification proves prohibited diagnosis/treatment/urgency/imperative/free-form factual fields do not reach publishable content, while `clinician_question` remains a question. _(Evidence provider: EH-148 safety-policy owner; EH-150 validator owner.)_
- [ ] Archive/remove-after-publication verification proves owner, share, and export reads use the EH-148 resolver, preserve the historical snapshot only while the parent document remains active, add `SOURCE_UNAVAILABLE`, and deny live/raw-source access without rewriting the persisted payload. _(Evidence provider: EH-148 read-resolver owner; EH-151 public-read owner; EH-153 export owner.)_
- [ ] Dynamics handoff evidence proves `biomarker_dynamics_period`, exact materialized document scope, and no client DTO/raw observations reach EH-149; the persisted extension contains only points in report scope. _(Evidence provider: EH-148 route/RPC owner; EH-149 comparison owner.)_
- [ ] Validation-envelope evidence proves new reports persist only `valid`/`limited` status, validator version, and stable issue codes; invalid and tampered structured rows fail closed, while legacy rows remain owner-readable through the resolver but are rejected by share/export. _(Evidence provider: EH-148 persistence/read-resolver owner; EH-150 validator owner; EH-151 share owner; EH-153 export owner.)_
- [ ] API/UI verification proves valid user-selected questions are normalized, persisted with `origin: user_selected`, rendered as questions in owner detail, and retained by authorized share/export reads; invalid question forms fail before persistence. _(Evidence provider: EH-148 contract/route owner; EH-151 share owner; EH-153 export owner.)_
- [ ] Report-date evidence proves inclusive UTC boundary behavior, authoritative source-date selection, undated exclusion, explicit out-of-range/undated document rejection, and exact persisted scope/mapping with no scope widening. _(Evidence provider: EH-148 route/RPC owner.)_
- [ ] Tombstone/race evidence proves the committed `make-document-deletion-durable` state invalidates a deleting source document's complete report before owner/share/export bytes are read, and document-first writer locking plus `write_generation` revalidation rejects tombstone/republish races with no stale report committed or served. _(Evidence provider: EH-148 RPC/read-resolver owner; durable-deletion owner; EH-151 share owner; EH-153 export owner.)_

## Automated regression coverage

- [x] `pnpm test:eh148-contract` verifies the canonical section order, typed claim/source/limitation references, opaque source projection for all six source kinds, bounded questions, inclusive UTC end-date handling, deterministic candidate rendering with user-selected question origin, rejection of model-authored factual text and imperative generated question text, and rejection of an unknown citation. _(Executed 2026-09-22; passed.)_

## Local verification record

- `pnpm exec tsc --noEmit --pretty false` passed after the contract, safety-policy, resolver, and typed-renderer changes.
- `pnpm test:eh104` passed the durable writer/document-delete boundary checks.
- `pnpm test:eh148-contract` passed after updating the fixture to use a valid-shaped unknown source ID.
- `pnpm exec supabase db lint` is `BLOCKED`: local Postgres is not running; migration 083 needs target/CI SQL validation.
- EH-150's validator module is present in current master and its contract verifier passes. The EH-148 generation route still fails closed with HTTP 503 because the service-owned validator call, structured persistence RPC integration, and runtime handoff are not complete. No publishable new report is claimed from this partial implementation.
- Report UI checks remain `N/A`: the service generation route intentionally fails closed until it is cut over to the structured candidate, validator, and persistence path.

## Out of scope or not manually testable yet

- Citation semantics, token verification, access logs, and export format fidelity are covered by EH-150, EH-151/EH-152, and EH-153.
- Manual interface rows remain `N/A` until the report generation and detail UI are delivered; automated contract evidence above does not constitute manual product sign-off.
