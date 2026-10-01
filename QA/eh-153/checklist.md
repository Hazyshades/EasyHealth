# EH-153: Report Export Package

**Roadmap status:** Implemented; product QA pending
**Build / environment:** Windows 11, Node 22, pnpm 9.15.4; fixture verifier uses `SKIP_ENV_VALIDATION=1`
**Test run date:** 2026-10-01
**Tester:** Automated developer evidence; product tester handoff pending

## What this checklist covers

This checklist covers PDF, CSV, and JSON exports from the validated report contract, including source references, limitations, ranges, timestamps, versions, Unicode, and scope enforcement. It does not accept an export that merely looks complete while omitting evidence.

## Before you start

- [ ] Use a dedicated owner account and, for shared checks, a separate recipient browser/profile.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID                    | Test document or setup                                                                                                      | Purpose                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `EH153-REPORT-01`     | Validated mixed-source report with citations, ranges, limitations, and Unicode labels                                       | Normal export                   |
| `EH153-DYNAMICS-01`   | Persisted EH-149 frozen dynamics extension with native/display units and source points                                      | Measurement CSV                 |
| `EH153-LIMIT-01`      | Validated report with an explicit missing-evidence limitation                                                               | Limitation fidelity             |
| `EH153-LEGACY-01`     | Legacy/unvalidated report                                                                                                   | Fail-closed export              |
| `EH153-SOURCES-01`    | Mixed validated report containing finding, note, prescription/referral, and document-summary sources                        | Complete CSV source ledger      |
| `EH153-BIND-01`       | Validated report created with `biomarker_dynamics_period` whose selected period is persisted in the EH-148 report extension | Frozen dynamics binding         |
| `EH153-ARCHIVE-01`    | Validated report exported after a cited source row is archived/removed while its parent document remains active             | Source-unavailable fidelity     |
| `EH153-SCOPE-01`      | Report with one selected document and another owned eligible document outside materialized scope                            | Dynamics/export scope isolation |
| `EH153-VALIDATION-01` | Valid, limited, invalid, legacy, and tampered validation-envelope fixtures                                                  | Validation envelope gate        |
| `EH153-TOMBSTONE-01`  | Validated report exported after a cited source document enters `deleting`/tombstoned state                                  | Whole-report fail-closed export |

## Interface checks

### EH153-UI-01: Download all owner formats

**Precondition:** The owner has `EH153-REPORT-01` and `EH153-SOURCES-01` open on the report detail page.

1. Choose **Export PDF** and open the file.
2. Choose **Export CSV** and inspect rows.
3. Choose **Export JSON** and inspect the contract.

**Expected result:** PDF, CSV, and JSON match the visible report sections and limitations. PDF/JSON include the full contract; CSV includes deterministic metadata, claim, source, and measurement rows with generated-at time, contract/validator versions, citations, complete source references, disclaimer, and no unrelated document or storage path.

**Result:** `BLOCKED`
**Notes / evidence link:** The leaf `ReportExportActions` component is implemented, but EH-148 owns authenticated detail-page wiring and EH-151 owns the named public-share slot. Manual product execution remains pending those handoffs.

### EH153-UI-02: Verify Unicode PDF

**Precondition:** `EH153-REPORT-01` contains Cyrillic, accented Latin, a long filename, and a non-ASCII unit label.

1. Download the PDF.
2. Inspect every page at normal zoom and search/select the Unicode text.

**Expected result:** Text is readable/selectable, page breaks do not remove citations or limitations, and no partial/corrupt PDF is returned.

**Result:** `BLOCKED`
**Notes / evidence link:** Unicode fixture and embedded `DejaVuSans.ttf` are covered by `pnpm test:eh153`; product-page selection/search verification remains pending EH-148 integration.

### EH153-UI-03: Verify CSV provenance

**Precondition:** `EH153-DYNAMICS-01` is included in the validated report.

1. Download CSV.
2. Inspect a converted point and a native-range point.
3. Compare observation/document IDs and dates with the on-screen source ledger.

**Expected result:** Measurement rows preserve native/display values and units, range, date, source observation/document IDs, and conversion metadata. Metadata, claim, and source rows preserve limitations, claim status/text, citation IDs, source kind/document ID/snapshot/label, and deterministic order; narrative claims are not fabricated as measurements.

**Result:** `BLOCKED`
**Notes / evidence link:** CSV fixture coverage passed in `pnpm test:eh153`; product download execution remains pending EH-148 integration.

### EH153-UI-04: Deny legacy or out-of-scope export

**Precondition:** Open `EH153-LEGACY-01` or a shared report whose policy excludes a requested format/document.

1. Attempt the unavailable export through the product UI.

**Expected result:** The action is hidden or fails generically. No partial file, unrelated source, or raw storage path is returned.

**Result:** `BLOCKED`
**Notes / evidence link:** Adapter fixtures reject legacy reports, denied formats, scope mismatch, and tampered dynamics. Product action wiring remains pending EH-148/EH-151.

## Developer evidence required

- [x] Owner and EH-151 share adapter boundaries reject legacy/unvalidated content and enforce exact scope before serialization. `pnpm test:eh153` covers the EH-153 injected resolver seam; EH-151 live capability wiring remains a handoff.
- [x] PDF renderer/font verification covers Unicode, long labels, canonical section order, and explicit invalid-output handling. `pnpm test:eh153` confirms a non-partial PDF header and Unicode fixture.
- [x] CSV/JSON fixtures prove metadata, claims, complete mixed-source ledger rows, ranges, source IDs, timestamps, versions, limitations, and conversion metadata. `pnpm test:eh153` passed.
- [x] Response construction requires an explicit owner/share context and applies the supplied public-share response policy callback before returning the response, and sets private/no-store and no-sniff headers. `pnpm test:eh153` asserts at compile time that EH-151's real `applyPublicShareResponsePolicy` is assignable to the export policy contract, so the helper seam cannot drift.
- [x] Frozen-dynamics evidence proves serialization reads the persisted EH-149 extension returned by the EH-148 resolver seam and rejects an out-of-scope point; no client DTO or raw observation input is accepted by the package API.
- [ ] Source-unavailable evidence for live archive/tombstone RPC outcomes remains pending EH-148 durable-deletion integration; fixture scope and generic unavailable paths are covered.
- [x] Scope-isolation evidence rejects report-scope mismatch and out-of-scope dynamics points before serialization.
- [x] Validation-envelope evidence projects only safe status/version fields, omits internal issue codes, and rejects invalid, legacy, tampered, missing, unknown, duplicate, and incomplete fixtures.
- [x] Section-contract evidence rejects unknown, duplicate, or missing section containers and preserves canonical order in JSON, CSV, and PDF projections.

## Automated developer evidence

Command:

```text
SKIP_ENV_VALIDATION=1 pnpm test:eh153
```

Result: passed. `pnpm exec tsc --noEmit` also passed. The verifier covers deterministic JSON, ordered CSV, Unicode PDF bytes, response-policy application, owner/share format policy, legacy/tampered/malformed inputs, scope checks, safe public fields, and server-rendered export action markup. Visual product-page verification is blocked on EH-148/EH-151 integration.

Additional automated evidence:

- `SKIP_ENV_VALIDATION=1 pnpm test:eh153` — asserts byte-equal PDF output for the same projection (deterministic `creationDate` plus normalized font-subset tags).
- `pnpm test:eh149`, `pnpm test:eh148-contract`, `pnpm test:eh150`, `pnpm test:eh151`, `pnpm test:eh152` — pass after the persisted-dynamics resolver hardening and the master rebase.
- `pnpm check:ci-suite-coverage` and `pnpm check:ci-suite-coverage-contract` — pass with `test:eh153` registered in `ci/verification-suite-policy.json` and the `verify` job.

## Out of scope or not manually testable yet

- Product page wiring is intentionally owned by EH-148 and EH-151; this change supplies the leaf actions contract and server export boundary only.
- Live Supabase archive/tombstone and public-share helper verification requires the upstream integration surfaces and is not marked as tested here.
