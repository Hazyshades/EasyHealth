# EN + RU + ES lab pipeline: read labs in three languages

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

The app can now read laboratory reports written in English, Russian and Spanish.
The reviewer sees the test name exactly as the document printed it, plus the
app's own English name for the measurement when it recognises one, together with
the original value, unit and reference range.

Boundary in plain language: **the app itself is still in English.** Menus,
buttons, status wording and explanations do not change language. Only the
document content is multilingual. There is no language switcher, and one is not
expected in this item.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm each uploaded document has finished processing before reviewing it,
  unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `ML-EN-01` | English lab report with Hemoglobin, Glucose (serum), ALT | Normal English path, regression |
| `ML-RU-01` | Russian lab report with **Гемоглобин**, **Лейкоциты**, **ТТГ**, **Свободный Т4** and stated material (сыворотка / цельная кровь) | Normal Russian path |
| `ML-RU-02` | Russian report containing **Глюкоза** with no material stated | Incomplete-data path |
| `ML-RU-03` | Russian report containing an invented marker, e.g. **Неизвестный маркер XYZ** | Unknown marker stays unrecognised |
| `ML-ES-01` | Spanish report with **Glucosa**, **Triglicéridos**, **Creatinina**, **Hemoglobina glucosilada** and stated material (suero / sangre total) | Normal Spanish path with accents |
| `ML-ES-02` | Spanish report where an accent is missing, e.g. **Trigliceridos** | Accent-tolerant matching |
| `ML-ES-03` | Spanish report with a qualitative result printed as **Negativo** | Qualitative wording preserved |
| `ML-RU-04` | Russian report with a qualitative result printed as **Отрицательно** | Qualitative wording preserved |
| `ML-NEG-01` | A document that is clearly not a lab report (for example a receipt) | Nothing is invented |

## Interface checks

### ML-UI-01: Russian report is read and matched

**Precondition:** `ML-RU-01` uploaded and finished processing.

1. Go to **Documents** and open `ML-RU-01`.
2. Look at the **Extracted biomarkers** panel.

**Expected result:** Each row shows the Russian test name exactly as printed
(for example `Гемоглобин`). Rows the app recognises also show the English
measurement name underneath (for example `Canonical: Hemoglobin`) and are marked
**Matched measurement**. The value, unit and reference range are the ones printed
in the document.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-02: Spanish report with accents is read and matched

**Precondition:** `ML-ES-01` uploaded and finished processing.

1. Open `ML-ES-01` in **Documents**.
2. Find the row printed as `Triglicéridos`.

**Expected result:** The row shows `Triglicéridos` with its accent, is marked
**Matched measurement**, and shows the English name `Triglycerides`. The accent
is not stripped or replaced with a question mark or other placeholder.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-03: Missing accent still matches

**Precondition:** `ML-ES-02` uploaded and finished processing.

1. Open `ML-ES-02`.
2. Find the row printed as `Trigliceridos` (no accent).

**Expected result:** The row is still matched to `Triglycerides`. The label shown
is the one the document printed, without an accent added by the app.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-04: Missing material is reported, not guessed

**Precondition:** `ML-RU-02` uploaded and finished processing.

1. Open `ML-RU-02` and find the `Глюкоза` row.

**Expected result:** The row shows `Глюкоза` with its value and unit, and is
marked **More details needed** with an English explanation that the specimen is
not stated in the report. The app does not display a specimen such as `Serum`
that the document never printed, and does not show a confirmed measurement name.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-05: Unknown marker is preserved, not invented

**Precondition:** `ML-RU-03` uploaded and finished processing.

1. Open `ML-RU-03` and find the invented marker row.

**Expected result:** The row is marked **Measurement not recognized** and still
shows the original Russian label, value and unit. No English measurement name is
shown for it. The row can still be accepted as a raw record.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-06: Qualitative wording is kept in the document's language

**Precondition:** `ML-RU-04` and `ML-ES-03` uploaded and finished processing.

1. Open `ML-RU-04` and find the qualitative row.
2. Open `ML-ES-03` and find the qualitative row.

**Expected result:** The results read `Отрицательно` and `Negativo` exactly as
printed. They are not rewritten to `Negative` in the value shown to the reader.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-07: Accepting a Russian or Spanish row stores it

**Precondition:** `ML-RU-01` open with at least one matched row.

1. Select a matched row.
2. Use the confirmation action on the panel.
3. Go to **Biomarkers**.

**Expected result:** The accepted result appears in **Biomarkers**. The original
document label remains visible on the document page. No error is shown.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-08: English reports are unchanged

**Precondition:** `ML-EN-01` uploaded and finished processing.

1. Open `ML-EN-01` and review the extracted rows.

**Expected result:** Behaviour matches what English documents did before this
change: the same rows are recognised, the same wording is used, and nothing new
is required from the reviewer.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-09: A non-lab document does not invent results

**Precondition:** `ML-NEG-01` uploaded.

1. Open `ML-NEG-01`.

**Expected result:** No biomarker rows are invented. If the document type was
declared as a lab report, the app shows its usual type-mismatch notice.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### ML-UI-10: Interface language is unchanged

**Precondition:** Any Russian or Spanish document open.

1. Read the panel headings, buttons and status wording.

**Expected result:** All app wording stays in English, including
**Matched measurement**, **More details needed** and
**Measurement not recognized**. There is no language switcher.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

| Contract | Evidence | Command |
| --- | --- | --- |
| Pure-Cyrillic and Spanish labels never normalise to an empty or number-only token | `scripts/verify-multilingual-lab-pipeline.ts` | `pnpm test:multilingual` |
| Identifier normalisation (`snakeCaseToken`) is unchanged | same | `pnpm test:multilingual` |
| Every resolver-admitted alias declares locale `en`, `ru` or `es` | same, plus `validateMeasurementRegistry` | `pnpm test:measurement-registry` |
| Every launch-slice measurement has reviewed EN, RU and ES aliases | same | `pnpm test:multilingual` |
| Reviewed label collisions across different analytes fail the catalog build | `validateMeasurementRegistry` | `pnpm test:measurement-registry` |
| Verbatim label and qualitative wording are required by the extraction contract | `scripts/verify-multilingual-lab-pipeline.ts` | `pnpm test:multilingual` |
| An English key hint alone cannot produce a confirmed match | same | `pnpm test:multilingual` |
| Unknown rows stay `unmapped` and never add a catalog entry | same | `pnpm test:multilingual` |
| RU/ES corpus fixtures really contain that language | corpus authenticity gate | `pnpm test:multilingual`, `pnpm check:registry-v2-candidate-corpus-technical` |
| Per-language release gates are evaluated separately | `policy.languageThresholds` + corpus runner | `pnpm check:registry-v2-candidate-corpus-technical` |
| English corpus does not regress | 53 English rows, 0 classification failures | `pnpm verify:registry` |
| Review row exposes original label plus canonical English name only when resolved | `scripts/verify-multilingual-lab-pipeline.ts` | `pnpm test:multilingual` |
| Existing schema-1 decision traces still validate and need no backfill | `scripts/verify-resolver-trace-v2.ts`, `supabase/tests/resolver_trace_v2_alias_evidence.sql` | `pnpm test:trace-v2`, `pnpm test:trace-v2-db` |
| New decisions persist schema-2 alias evidence (locale, laboratory, fold-fallback, alias identity) | same | same |
| Alias evidence survives database write and read-back for RU and ES | `supabase/tests/resolver_trace_v2_alias_evidence.sql` | `pnpm test:trace-v2-db` |
| Stored traces stay immutable | same | `pnpm test:trace-v2-db` |
| `resolver_decision_trace` and `resolver_evidence` cannot diverge | writer assertion + `eh122_trace_matches_resolver_evidence` | `pnpm test:trace-v2`, `pnpm test:trace-v2-db` |

Evidence owner: the implementing engineer records the command output on the
delivery issue.

## Out of scope or not manually testable yet

- **Interface translation is out of scope.** No translated menus, messages or
  locale switcher. That is a separate change.
- **Catalog breadth.** Only the first launch slice (CBC, basic biochemistry,
  lipids, thyroid, common liver and kidney markers, glucose and HbA1c, and the
  launch qualitative tests) is guaranteed to have EN + RU + ES aliases. Other
  measurements may still be English-only.
- **Automatic catalog growth is deliberately not implemented.** An unknown
  marker is preserved as a raw result and never creates a new measurement.
- **Release approval.** The candidate input hash moved, so
  `pnpm check:registry-v2-candidate-corpus` stays red until the hash-bound
  approvals in `registry/candidate-release/v1/approvals.json` are re-issued by
  their named owners. The technical gate passes.
- **Historical documents.** Documents processed before this change keep the
  labels they were stored with. Improving them requires an explicit reprocess.
