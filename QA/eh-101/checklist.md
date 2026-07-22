# EH-101: Audit and freeze the Biomarker Registry v1 baseline

**Roadmap status:** Delivered baseline  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-101 creates an audited Registry v1 baseline. It is not supposed to change
the user interface. These are regression checks: existing laboratory documents
and biomarker views must keep working as they did before the baseline was
frozen.

## Before you start

- [ ] Use a dedicated test account that already has a processed laboratory
  document with at least two known values.
- [ ] Record the expected value, unit, reference range, and date from that
  document before testing.
- [ ] Do not use a real patient document.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `LAB-BASELINE` | A processed synthetic lab report with two known measurements | Regression baseline |

## Interface checks

### EH101-UI-01: Existing laboratory document remains readable

1. Open **Documents**.
2. Open `LAB-BASELINE`.
3. In **Extracted biomarkers** or **Biomarkers**, compare each visible value,
   unit, reference range, and date with the recorded expected data.

**Expected result:** The existing values remain readable and unchanged. No
registry version, internal key, or migration warning is shown to the user.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH101-UI-02: Source navigation still works

1. In the same document, select a listed biomarker result.
2. Observe the document preview.

**Expected result:** The preview opens or moves to the source page/text for the
selected result when source data is available. The selected result still matches
the document.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH101-UI-03: Biomarker history is unchanged

1. Open **Biomarkers**.
2. Locate a biomarker from `LAB-BASELINE`.
3. Check the table row and, when there are multiple points, its trend chart.
4. Refresh the browser once and repeat the check.

**Expected result:** The expected value and date appear once, with the same
unit and status as before. Refreshing does not create a duplicate or remove the
historical point.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply the versioned Registry v1 snapshot/manifest and its integrity
  check or CI result. It proves that the frozen baseline is reproducible.
- [ ] Supply the audit report showing every previous registry key has a
  disposition (kept, merged, retired, or clarified).
- [ ] Confirm that this delivery introduced no runtime behavior change. A code
  review or release note is sufficient.

## Out of scope or not manually testable yet

- Editing the Registry v1 baseline is not a user-facing workflow.
- Registry 2.0 recognition and identity changes belong to EH-102 and later.
