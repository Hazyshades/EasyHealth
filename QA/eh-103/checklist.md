# EH-103: Raw evidence and version provenance for observations

**Roadmap status:** Delivered  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-103 keeps the original laboratory evidence attached to the accepted result.
After review or reprocessing, a tester must still be able to compare the shown
result with the original document rather than rely on a rewritten label alone.

## Before you start

- [ ] Use a dedicated test account and a synthetic laboratory document with a
  distinctive label, numeric value, unit, reference text, and page location.
- [ ] Keep a copy of the original test document open for comparison.
- [ ] Record the original source text before starting a reprocess check.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `LAB-PROVENANCE` | Synthetic report with distinctive source wording and a reference range | Source preservation |
| `LAB-PROVENANCE-PARTIAL` | Synthetic report with a raw result that cannot be fully identified | Safe raw-data retention |

## Interface checks

### EH103-UI-01: A result can be traced back to the document

1. Upload `LAB-PROVENANCE` through **Upload lab results**.
2. When processing has finished, open it in **Documents**.
3. In **Extracted biomarkers**, select the result with the distinctive label.
4. Compare the visible value, unit, reference text, source excerpt, and page
   with the original document preview.

**Expected result:** The displayed information points to the same source value
and document area. The app does not replace the original evidence with an
unrelated normalized name or unit.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH103-UI-02: Accepted result keeps its raw evidence after refresh

1. Complete the document's normal review/accept action when offered.
2. Refresh the browser and reopen the document.
3. Select the same result again and compare it with the source document.

**Expected result:** The accepted result still shows the same raw label, value,
unit, reference text, and source location as before refresh.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH103-UI-03: Reprocessing does not silently rewrite the source result

1. In the open document, select **Reprocess**.
2. Wait for processing to finish and reopen the result.
3. Compare the raw evidence with the original document and the notes recorded
   before reprocessing.

**Expected result:** The source evidence remains attributable to the same
document. If extraction changes, the current display must still match the
original document; it must not show a different source value without evidence.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH103-UI-04: Unresolved data remains visible without false identity

1. Upload `LAB-PROVENANCE-PARTIAL`.
2. Open it after processing and inspect the extracted result.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The raw source value remains available in the document,
but it is not presented as a confidently identified biomarker or assessment
input merely because its text/value exists.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply the automated test or audit output proving raw source fields and
  processing/release identifiers are write-once for an accepted revision.
- [ ] Supply a reprocess scenario proving that a later revision does not
  overwrite a different source row merely because date/analyte text matches.
- [ ] Supply API contract evidence for any provenance fields that are not
  currently visible in the document interface.

## Out of scope or not manually testable yet

- Full revision-history browsing is not required in the current user interface.
- Resolver outcome and verification lifecycle checks are covered by EH-104.
