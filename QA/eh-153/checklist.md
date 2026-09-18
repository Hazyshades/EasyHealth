# EH-153: Report Export Package

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers PDF, CSV, and JSON exports from the validated report contract, including source references, limitations, ranges, timestamps, versions, Unicode, and scope enforcement. It does not accept an export that merely looks complete while omitting evidence.

## Before you start

- [ ] Use a dedicated owner account and, for shared checks, a separate recipient browser/profile.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH153-REPORT-01` | Validated mixed-source report with citations, ranges, limitations, and Unicode labels | Normal export |
| `EH153-DYNAMICS-01` | Dynamics DTO with native/display units and source points | Measurement CSV |
| `EH153-LIMIT-01` | Validated report with an explicit missing-evidence limitation | Limitation fidelity |
| `EH153-LEGACY-01` | Legacy/unvalidated report | Fail-closed export |
| `EH153-SOURCES-01` | Mixed validated report containing finding, note, prescription/referral, and document-summary sources | Complete CSV source ledger |
| `EH153-BIND-01` | Validated report whose selected dynamics period is persisted in the EH-148 report extension | Frozen dynamics binding |
| `EH153-ARCHIVE-01` | Validated report exported after a cited source is archived or deleted | Source-unavailable fidelity |

## Interface checks

### EH153-UI-01: Download all owner formats

**Precondition:** The owner has `EH153-REPORT-01` and `EH153-SOURCES-01` open on the report detail page.

1. Choose **Export PDF** and open the file.
2. Choose **Export CSV** and inspect rows.
3. Choose **Export JSON** and inspect the contract.

**Expected result:** PDF, CSV, and JSON match the visible report sections and limitations. PDF/JSON include the full contract; CSV includes deterministic metadata, claim, source, and measurement rows with generated-at time, contract/validator versions, citations, complete source references, disclaimer, and no unrelated document or storage path.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

### EH153-UI-02: Verify Unicode PDF

**Precondition:** `EH153-REPORT-01` contains Cyrillic, accented Latin, a long filename, and a non-ASCII unit label.

1. Download the PDF.
2. Inspect every page at normal zoom and search/select the Unicode text.

**Expected result:** Text is readable/selectable, page breaks do not remove citations or limitations, and no partial/corrupt PDF is returned.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

### EH153-UI-03: Verify CSV provenance

**Precondition:** `EH153-DYNAMICS-01` is included in the validated report.

1. Download CSV.
2. Inspect a converted point and a native-range point.
3. Compare observation/document IDs and dates with the on-screen source ledger.

**Expected result:** Measurement rows preserve native/display values and units, range, date, source observation/document IDs, and conversion metadata. Metadata, claim, and source rows preserve limitations, claim status/text, citation IDs, source kind/document ID/snapshot/label, and deterministic order; narrative claims are not fabricated as measurements.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

### EH153-UI-04: Deny legacy or out-of-scope export

**Precondition:** Open `EH153-LEGACY-01` or a shared report whose policy excludes a requested format/document.

1. Attempt the unavailable export through the product UI.

**Expected result:** The action is hidden or fails generically. No partial file, unrelated source, or raw storage path is returned.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

## Developer evidence required

- [ ] Owner and EH-151 share adapters reject legacy/unvalidated content and enforce exact scope before serialization. *(Evidence provider: EH-153 export-adapter owner; EH-151 share owner.)*
- [ ] PDF renderer/font verification covers Unicode, long content, empty sections, and explicit failure. *(Evidence provider: EH-153 serializer owner.)*
- [ ] CSV/JSON fixtures prove metadata, claims, complete mixed-source ledger rows, ranges, source IDs, timestamps, versions, limitations, and conversion metadata are preserved. *(Evidence provider: EH-153 serializer owner.)*
- [ ] Response headers and download-policy evidence prove `applyPublicShareResponsePolicy` runs before shared PDF/CSV/JSON bytes are returned and are supplied to EH-154. *(Evidence provider: EH-151 policy-helper owner; EH-153 public-export owner; EH-154 gate owner.)*
- [ ] Frozen-dynamics evidence proves export selects the persisted EH-149 extension through EH-148's read resolver, preserves period/schema/policy metadata, and rejects client DTO or raw-observation substitution. *(Evidence provider: EH-153 adapter/serializer owner; EH-148 read-resolver owner; EH-149 DTO owner.)*
- [ ] Source-unavailable evidence proves archive/delete-after-publication exports preserve the historical snapshot and `SOURCE_UNAVAILABLE` limitation while denying live/raw-source content. *(Evidence provider: EH-148 read-resolver owner; EH-153 export owner; EH-151 public-read owner.)*

## Out of scope or not manually testable yet

- Report generation and citation validation are owned by EH-148 and EH-150.
- This checklist is planned; no row is evidence of an executed test until the implementation exists.
