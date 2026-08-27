# EH-164: Preserve censored lab results as printed text

**Roadmap status:** In progress ([#183](https://github.com/Hazyshades/EasyHealth/issues/183); Registry docs [#188](https://github.com/Hazyshades/EasyHealth/issues/188))
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

Printed detection-limit results such as `< 0.20` and `> 10` must stay as the printed text. They must not become a bare number, must not occupy the `modifier` clinical axis, must show **Threshold result** on **Biomarkers**, must not plot as `0.20` on the trend, and must not enter Health Profile scores.

## Before you start

- [ ] Use a dedicated test account with access to **Documents**, **Biomarkers**, and **Health Profile**.
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Confirm extraction has finished before judging stored values, unless the check is about processing failure.
- [ ] Keep a copy of the printed line so the stored text can be compared with the page.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH164-CRP-01` | Synthetic lab report with `CRP < 0.20 mg/L` (or equivalent printed detection limit) | Normal path: printed comparator stays text |
| `EH164-DIP-01` | Synthetic urine dipstick with `2+` (or `++`) | Regression: ordinal grades stay ordinal |
| `EH164-CORR-01` | Same as `EH164-CRP-01` after the row is accepted | EH-119 restatement of `< 0.20` stays text |

## Interface checks

### EH164-UI-01: Printed comparator is not shown as an exact number

**Precondition:** `EH164-CRP-01` has finished processing and its laboratory row is visible in **Documents**.

1. Open **Documents** and select `EH164-CRP-01`.
2. Find the CRP (or equivalent) extracted row.
3. Confirm the displayed value includes `<` (or `>`) exactly as printed.
4. Open **Biomarkers** and find the same result after acceptance.

**Expected result:** The value is the printed text (for example `< 0.20`), not `0.2` or `0.20` without the comparator. The status chip is **Threshold result**, not **Normal**, **Attention**, or **Low**.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH164-UI-02: Trend does not plot the threshold as 0.20

**Precondition:** The accepted `EH164-CRP-01` row is visible on **Biomarkers** and a numeric series exists for that measurement or the series is empty except this row.

1. Open **Biomarkers**.
2. Select the measurement for the censored row.
3. Inspect the trend / comparison chart.

**Expected result:** The censored result is not a connected numeric point at `0.20`. The printed text remains visible in the table.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH164-UI-03: Health Profile does not score the censored result

**Precondition:** `EH164-CRP-01` is accepted. If this measurement would otherwise feed a body-system score, note the system before the upload.

1. Open **Health Profile**.
2. Check whether the censored result appears as a scored numeric marker.

**Expected result:** The row is not used as a finite numeric assessment input. The profile does not treat `< 0.20` as exactly `0.20`.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH164-UI-04: Restating the printed comparator stays text

**Precondition:** `EH164-CORR-01` is open in the document review workspace with correction available.

1. Open the row's correction controls.
2. Restate the value as the printed text `< 0.20` (or the fixture's exact printed comparator).
3. Enter a reason and save.
4. Reload **Documents** and **Biomarkers**.

**Expected result:** The observation remains printed text. No exact `0.20` is synthesised. Status remains **Threshold result**.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH164-UI-05: Dipstick `2+` is unchanged

**Precondition:** `EH164-DIP-01` has finished processing.

1. Open the extracted urine row.
2. Confirm the printed grade `2+` (or `++`) is kept.

**Expected result:** The result is a graded/ordinal text value, not a threshold number and not stripped to `2`.

**Result:** `Not run`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] `pnpm test:eh164` — parser, extraction rescue, modifier coercion, correction base, comparison exclusion, Health Profile admission. Owner: implementer/CI.
- [ ] `pnpm test:eh119` — existing correction contract still refuses numeric restatement of comparator text.
- [ ] `pnpm typecheck` — compilation of parser, extraction, UI, and Health Profile changes.
- [ ] `openspec validate eh-164-preserve-censored-lab-results --strict` — change artifacts valid.
- [ ] `pnpm check:ci-suite-coverage` — `test:eh164` is workflow-reachable on the verify job.
- [ ] Read-only audit: `scripts/audit-eh164-censored-results.sql` lists already-corrupted rows; no UPDATE. Owner: operator against a disposable snapshot.
- [ ] Registry documentation: `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`. Wiki publication status recorded on the Registry docs tracking issue.
- [ ] Database tests: **not applicable**. No migration, constraint, RLS, or writer RPC was added. Persistence is the existing `value_kind` / `value_text` / nullable `value` contract.

## Out of scope or not manually testable yet

- `value_relation` / `threshold_value` columns and special chart glyphs.
- Silent UPDATE of already-accepted observations (audit + reprocess/correction only).
- Interval values (`3.5–4.0`).
- EH-165 dates, rotation OCR, durable deletion.
