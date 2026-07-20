# EH-102: Registry 2.0 launch catalog and safe laboratory recognition

**Roadmap status:** Delivered  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-102 moves laboratory recognition to Registry 2.0. A result with enough
evidence may become a normal biomarker; incomplete or ambiguous source text
must remain safe and must not become a guessed measurement in trends or Health
Profile.

## Before you start

- [ ] Use a dedicated test account with no unrelated laboratory documents, or
  note the baseline values that already exist.
- [ ] Ask the QA lead for the synthetic launch-catalog fixtures listed below.
- [ ] Wait for document processing to finish before checking the result.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `LAB-RESOLVED` | Synthetic lab report with a reviewed, unambiguous measurement | Normal recognition |
| `LAB-PARTIAL` | Synthetic report missing required identity context | Incomplete-data safety |
| `LAB-AMBIGUOUS` | Synthetic report whose label can mean more than one measurement | Ambiguity safety |

## Interface checks

### EH102-UI-01: Recognized laboratory value is shown with its source

1. Go to **Upload lab results** and upload `LAB-RESOLVED`.
2. Wait until processing finishes, then open the document from **Documents**.
3. Open **Extracted biomarkers**.
4. Select the recognized result and compare its visible value, unit, and source
   text/page with the original test document.

**Expected result:** The visible value and unit match the document. Selecting
the result points to the correct source area when source data is available.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH102-UI-02: Reviewed result reaches the normal biomarker view

1. Complete the normal review/accept action if the document asks for it.
2. Open **Biomarkers**.
3. Locate the measurement from `LAB-RESOLVED` and inspect its table row.

**Expected result:** The value appears once with the expected value, unit,
reference information, and date. A trend is shown only when there is enough
numeric history.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH102-UI-03: Incomplete source data is not guessed

1. Upload `LAB-PARTIAL` and open it after processing.
2. Check the document's extracted result against the original source text.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The source result is retained for review, but it does not
appear as a confidently identified laboratory measurement, create a fabricated
trend, or change an assessment solely because required context was absent.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH102-UI-04: Ambiguous source data is not silently merged

1. Upload `LAB-AMBIGUOUS` and open it after processing.
2. Compare the visible source label/value with the document.
3. Check **Biomarkers** and **Health Profile** for a new resolved measurement
   derived only from this ambiguous row.

**Expected result:** The raw source remains available, but the app does not
silently choose one possible meaning and show it as a trusted trend or
assessment input.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH102-UI-05: Empty resolved trend is explained safely

1. Use an account whose available results are incomplete or ambiguous only.
2. Open **Biomarkers**.

**Expected result:** The page explains that no resolved measurement definition
is available for trends, rather than showing a chart with guessed data.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply automated coverage for the launch corpus, including the 44 sample
  row types and their resolved, partial, or ambiguous outcomes.
- [ ] Supply the launch manifest and Registry 2.0 review approval.
- [ ] Supply code-review or CI evidence that no Registry v1 runtime fallback,
  adapter, or dual-runtime feature flag remains.

## Out of scope or not manually testable yet

- Reviewing or editing the registry catalog itself is an internal workflow.
- Full provenance history is covered by EH-103.
