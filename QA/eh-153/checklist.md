# EH-153: Report Export Package

**Roadmap status:** Implemented; owner surface wired, product QA pending
**Build / environment:** Windows 11, Node 22, pnpm 9.15.4; fixture verifier uses `SKIP_ENV_VALIDATION=1`
**Test run date:** 2026-10-06
**Tester:** Local authenticated UI/API integration run

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

**Result:** `BLOCKED` for the complete live format set; CSV and JSON `PASS`, PDF live download not rerun after dependency restoration.
**Notes / evidence link:** The previous authenticated run recorded CSV and JSON downloads with `private, no-store` and the expected contracts. `pnpm install --frozen-lockfile` restored the declared `@react-pdf/renderer` package, and the current fixture verifier now proves PDF rendering. The authenticated UI PDF path still needs a fresh browser download.

### EH153-UI-02: Verify Unicode PDF

**Precondition:** `EH153-REPORT-01` contains Cyrillic, accented Latin, a long filename, and a non-ASCII unit label.

1. Download the PDF.
2. Inspect every page at normal zoom and search/select the Unicode text.

**Expected result:** Text is readable/selectable, page breaks do not remove citations or limitations, and no partial/corrupt PDF is returned.

**Result:** `BLOCKED`
**Notes / evidence link:** The server-side PDF fixture now passes Unicode/font assertions after dependency restoration. A fresh authenticated browser download and visual inspection remain pending.

### EH153-UI-03: Verify CSV provenance

**Precondition:** `EH153-DYNAMICS-01` is included in the validated report.

1. Download CSV.
2. Inspect a converted point and a native-range point.
3. Compare observation/document IDs and dates with the on-screen source ledger.

**Expected result:** Measurement rows preserve native/display values and units, range, date, source observation/document IDs, and conversion metadata. Metadata, claim, and source rows preserve limitations, claim status/text, citation IDs, source kind/document ID/snapshot/label, and deterministic order; narrative claims are not fabricated as measurements.

**Result:** `PARTIAL`
**Notes / evidence link:** The authenticated CSV endpoint and UI action returned a CSV with deterministic metadata headers and `private, no-store`. The seeded report did not contain a frozen dynamics extension, so converted-point provenance was not claimed.

### EH153-UI-04: Deny legacy or out-of-scope export

**Precondition:** Open `EH153-LEGACY-01` or a shared report whose policy excludes a requested format/document.

1. Attempt the unavailable export through the product UI.

**Expected result:** The action is hidden or fails generically. No partial file, unrelated source, or raw storage path is returned.

**Result:** `PARTIAL`
**Notes / evidence link:** Unsupported `format=xml` returned HTTP 400 `FORMAT_NOT_ALLOWED` with no file. The public-share export route now exists and enforces the share capability, but a valid recipient flow remains blocked on reviewed ingress and production-adapter fixtures.

### EH153-UI-05: Download an approved public-share export

**Precondition:** A reviewer has deployed the trusted HTTPS/mTLS ingress and
created a synthetic report-only share that allows JSON and PDF.

1. Open the share link in a separate recipient browser.
2. Complete the PIN form if the share requires a PIN.
3. Activate **Export JSON** and inspect the downloaded file.
4. Activate **Export PDF** and inspect the downloaded file.
5. Request a format omitted from the share policy.

**Expected result:** The share page shows only the permitted export actions.
JSON and PDF downloads contain the visible validated report scope and carry
no-store, noindex, and restrictive referrer headers. The omitted format is
denied without a file or internal validation details.

**Result:** `Blocked: reviewed trusted ingress and live share fixtures unavailable`
**Notes / evidence link:** The route is implemented at
`src/app/api/share/[token]/export/route.ts` and the page renders the shared
`ReportExportActions` component. Direct-origin requests remain fail-closed, so
this recipient-facing check is not marked as tested.

## Developer evidence required

- [x] Owner and EH-151 share adapter boundaries reject legacy/unvalidated content and enforce exact scope before serialization. `pnpm test:eh153-owner-export` passed; EH-151 live capability wiring remains a handoff.
- [x] PDF renderer/font verification: `pnpm install --frozen-lockfile` restored the declared `@react-pdf/renderer` dependency, and `pnpm test:eh153` passed the Unicode, embedded-font, PDF-date, and bounded-size assertions. A fresh authenticated browser download remains pending.
- [x] CSV/JSON fixture and owner-route checks passed through `pnpm test:eh153-owner-export`; the prior live CSV/JSON responses returned the expected content types, versions, and no-store policy.
- [x] Response construction requires an explicit owner/share context and applies no-store/private policy. `pnpm test:eh153-owner-export` passed the owner-route/error-policy checks, and `pnpm test:eh153` passed shared response-policy assertions.
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

Current result: `pnpm test:eh153` passed after `pnpm install --frozen-lockfile` with local placeholder environment values. `pnpm test:eh153-owner-export` also passed. The authenticated UI/API run independently passed JSON and CSV; the fresh live PDF browser download remains pending.

Additional automated evidence:

- `pnpm install --frozen-lockfile` resolved `@react-pdf/renderer` 4.3.0 from the committed lockfile.
- `pnpm test:eh153` passed the renderer/font, Unicode, canonical-section, deterministic serializer, policy, and oversized-report assertions.
- `pnpm test:eh149`, `pnpm test:eh148-contract`, `pnpm test:eh150`, `pnpm test:eh151`, `pnpm test:eh152` — pass after the persisted-dynamics resolver hardening and the master rebase.
- `pnpm check:ci-suite-coverage` and `pnpm check:ci-suite-coverage-contract` — pass with `test:eh153` registered in `ci/verification-suite-policy.json` and the `verify` job.
- `pnpm test:eh153-owner-export` — owner integration evidence: every export failure code maps to its public status with an opaque message, unknown throwables stay generic, download filenames lose path separators and control characters, authentication precedes format parsing, the route delegates to the owner adapter, and the actions render in exactly one `canExport`-gated branch.

## Out of scope or not manually testable yet

- Public-share page wiring and the public export route are now implemented by
  EH-151; this checklist consumes the EH-153 serializer and response-policy
  contracts.
- Live Supabase archive/tombstone and public-share helper verification requires the upstream integration surfaces and is not marked as tested here.

## Sprint 7 local integration run: 2026-10-06

- **Authenticated report detail:** The prior local run passed report rendering and export controls. A fresh browser PDF download is still pending after the dependency restore.
- **JSON/CSV:** The prior owner routes returned HTTP 200, attachment content types, expected version fields, and `private, no-store`; JSON started with `eh148.v1` and `eh153.json.v1`, and CSV started with `record_type,export_version`.
- **PDF fixture:** `PASS`. `pnpm test:eh153` produced a valid PDF with the embedded DejaVu font and Unicode assertions. Live browser inspection remains unmarked.
- **Public-share integration:** `PASS` for typecheck and route compilation. Recipient-facing download remains blocked on reviewed ingress and persisted production-adapter fixtures.
