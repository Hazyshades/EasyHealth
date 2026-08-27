# EH-165: Row-level observation dates from history tables

**Roadmap status:** In progress (implementation on feature branch; manual UI pending)
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

A laboratory history table can print the same test on several dates. After processing and accept, each dated value must become its own observation with that collected day. Missing column dates may use the document lab date. The app must not invent today. Re-accepting a document that previously collapsed several years onto one day must not silently delete that old observation.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH165-1X3-01` | Synthetic lab table: one analyte (Glucose) and three dated columns `2023-01-10`, `2024-01-09`, `2026-01-08` | Normal history-table path |
| `EH165-3X3-01` | Synthetic lab table: three analytes and three dated columns | Multi-analyte expansion |
| `EH165-HEADER-01` | Synthetic table whose dates appear only in column headers | Header dates apply to columns |
| `EH165-UNDATED-01` | Synthetic table with one dated column and one column with no date; document lab date `2026-03-04` | Fallback without inventing today |
| `EH165-COLLAPSE-01` | Document that was previously accepted so Glucose already exists on the document day, then reprocessed after this change | Re-accept must not auto-delete |

## Interface checks

### EH165-UI-01: Two years remain two observations

**Precondition:** Signed in; `EH165-1X3-01` has finished processing and extracted Glucose rows are visible.

1. Go to **Documents** and open `EH165-1X3-01`.
2. In **Extracted biomarkers**, select the Glucose values for `2023-01-10` and `2026-01-08`.
3. Accept the selected rows.
4. Go to **Biomarkers** and open Glucose.

**Expected result:** Two Glucose observations exist with dates `2023-01-10` and `2026-01-08`. They are not both stamped with the document date. The trend lists the two years in date order, not on one day.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH165-UI-02: Header-only dates still split columns

**Precondition:** Signed in; `EH165-HEADER-01` has finished processing.

1. Go to **Documents** and open `EH165-HEADER-01`.
2. Review the extracted Glucose (or equivalent) rows.
3. Accept the dated rows.
4. Go to **Biomarkers** and open that marker.

**Expected result:** Each header date becomes a separate observation. Values are not collapsed onto one day.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH165-UI-03: Undated column uses the document date, never today

**Precondition:** Signed in; `EH165-UNDATED-01` has finished processing; the document lab date is `2026-03-04`. Today's date is different from `2026-03-04`.

1. Go to **Documents** and open `EH165-UNDATED-01`.
2. Accept the dated column row and the undated column row.
3. Go to **Biomarkers** and open that marker.

**Expected result:** The dated column keeps its printed day. The undated column uses `2026-03-04`. Neither observation uses today's date.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH165-UI-04: Re-accept does not auto-delete the old collapsed row

**Precondition:** `EH165-COLLAPSE-01` already has a Glucose observation on the document day from an earlier collapse. The document has been reprocessed so dated extracted rows exist.

1. Go to **Documents** and open `EH165-COLLAPSE-01`.
2. Accept the newly dated extracted Glucose rows.
3. Go to **Biomarkers** and open Glucose.

**Expected result:** The new dated observations appear on their own days. The previously collapsed observation on the document day is still present. The product does not delete it automatically.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH165-UI-05: Same marker on the same day still upserts

**Precondition:** Signed in; a synthetic document repeats the same Glucose value twice on `2026-01-08`.

1. Accept both extracted rows.
2. Go to **Biomarkers** and open Glucose.

**Expected result:** One observation exists for that day, not two duplicate same-day rows.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh165` passed (2026-08-26): proves the date helper (row day → document day → null, never today), EH-119 override still wins, parser fixtures for 1×3 / 3×3 / header-only / undated / same-day uniqueness keys, extraction prompt rules, and writer SELECT wiring.
- [ ] Database tests are not applicable: no schema, uniqueness, or RPC change. `collected_at` storage and observation uniqueness already exist.

## Out of scope or not manually testable yet

- One medical event per history column (still one event per document).
- Year-only or month-only headers plotted as 1 January.
- Silent rewrite or deletion of already-collapsed observations.
- OCR rotation and durable deletion.
