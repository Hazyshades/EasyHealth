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

## Interface checks

### EH153-UI-01: Download all owner formats

**Precondition:** The owner has `EH153-REPORT-01` open on the report detail page.

1. Choose **Export PDF** and open the file.
2. Choose **Export CSV** and inspect rows.
3. Choose **Export JSON** and inspect the contract.

**Expected result:** All formats match the visible report sections and limitations. They include generated-at time, contract/validator versions, citations, source references, and the disclaimer. No unrelated document or storage path is present.

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

**Expected result:** Each measurement row preserves native/display values and units, range, date, source observation/document IDs, and conversion metadata. Narrative claims are not fabricated as measurements.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

### EH153-UI-04: Deny legacy or out-of-scope export

**Precondition:** Open `EH153-LEGACY-01` or a shared report whose policy excludes a requested format/document.

1. Attempt the unavailable export through the UI.
2. Attempt the same resource directly if a test harness permits it.

**Expected result:** The action is hidden or fails generically. No partial file, unrelated source, or raw storage path is returned.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-153 delivery.`

## Developer evidence required

- [ ] Owner and EH-151 share adapters reject legacy/unvalidated content and enforce exact scope before serialization.
- [ ] PDF renderer/font verification covers Unicode, long content, empty sections, and explicit failure.
- [ ] CSV/JSON fixtures prove ranges, source IDs, timestamps, versions, limitations, and conversion metadata are preserved.
- [ ] Response headers and download policy evidence are supplied to EH-154.

## Out of scope or not manually testable yet

- Report generation and citation validation are owned by EH-148 and EH-150.
- This checklist is planned; no row is evidence of an executed test until the implementation exists.
