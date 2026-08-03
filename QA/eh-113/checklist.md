# EH-113: CBC launch catalog special cases

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-113 makes CBC labels safer to normalize. A processed CBC result receives a concrete biomarker identity only when its label, unit, specimen, value type, and—where required—method agree. Incomplete or conflicting results must remain visible for review without being converted into another marker.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.
- [ ] Do not use real patient reports or values.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH113-CBC-01` | Synthetic whole-blood CBC with `NEU%`, `NEU` absolute count, `RDW-CV`, `RDW-SD`, `RETIC%`, absolute reticulocyte count, MPV, PDW, plateletcrit, and all five differential populations. | Normal reviewed identity path. |
| `EH113-CBC-02` | Synthetic CBC with `Segmented neutrophils` and `Band neutrophils`, explicitly marked `manual differential`. | Population and method distinction. |
| `EH113-CBC-03` | Synthetic CBC rows missing specimen, unit, value type, or manual/automated method; include an unsupported OCR label such as `NEU7`. | Incomplete and negative behavior. |

## Interface checks

### EH113-UI-01: Exact CBC results retain their distinct identities

**Precondition:** `EH113-CBC-01` is processed and available in **Documents**.

1. Go to **Documents** and open `EH113-CBC-01`.
2. Open **Extracted biomarkers**.
3. Review the neutrophil percentage and absolute-count rows, then the RDW-CV and RDW-SD rows.
4. Open the corresponding entries in **Biomarkers** or **Health Profile** when those entries are available.

**Expected result:** Percentage and absolute differential rows remain separate; RDW-CV and RDW-SD do not collapse into one result. The displayed units remain consistent with the source row. No row is relabeled as a different CBC measurement.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH113-UI-02: Manual segmented and band populations do not cross-map

**Precondition:** `EH113-CBC-02` is processed and available in **Documents**.

1. Go to **Documents** and open `EH113-CBC-02`.
2. Open **Extracted biomarkers**.
3. Compare `Segmented neutrophils` with `Band neutrophils`.
4. If a review control is available, verify the rows are presented as separate choices rather than one interchangeable neutrophil result.

**Expected result:** Segmented and band neutrophils remain distinct. A row marked manual differential must not silently appear as an automated differential result.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH113-UI-03: Incomplete or corrupted CBC evidence is not promoted

**Precondition:** `EH113-CBC-03` is processed and available in **Documents**.

1. Go to **Documents** and open `EH113-CBC-03`.
2. Open **Extracted biomarkers**.
3. Locate rows with a missing unit, missing specimen, missing method, or the unsupported `NEU7` OCR label.
4. If the interface exposes review status or a correction control, inspect the row before choosing a correction.
5. Navigate to **Biomarkers** or **Health Profile**.

**Expected result:** Incomplete rows remain pending, partial, ambiguous, or unmapped according to the available interface. They do not create a concrete biomarker entry, conversion, score contribution, or health-profile measurement before reviewed evidence is supplied. The unsupported OCR label must not be silently corrected to neutrophils.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH113-UI-04: Reprocess does not turn incomplete context into identity

**Precondition:** `EH113-CBC-03` has at least one incomplete CBC row.

1. In **Documents**, open `EH113-CBC-03`.
2. Run **Reprocess** if that control is available for the test environment.
3. Wait for processing to complete and reopen **Extracted biomarkers**.
4. Recheck the incomplete row and downstream **Biomarkers** or **Health Profile**.

**Expected result:** Reprocessing preserves the raw CBC evidence. It must not manufacture a unit, specimen, method, or a concrete identity for the incomplete row.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:measurement-registry` — passed on 2026-08-03: `verify-measurement-registry: all checks passed`. Covers typed provisional launch-catalog definitions, accepted source units, intentionally unitless qualitative ELISA rows, removal of shadow unit conflicts, and the incomplete-resolution projection contract.
- [x] `pnpm test:eh113` — passed on 2026-08-03: `verify-eh113-cbc-launch-catalog: all checks passed`. Covers the reviewed CBC fixture matrix: five-part percent/absolute forms, RDW variants, reticulocyte forms, platelet indices, manual segmented/band populations, multilingual aliases, missing axes, unit conflicts, and an unsupported OCR negative.
- [x] `pnpm test:registry-v2-runtime` — passed on 2026-08-03: `verify-registry-v2-runtime-cutover: all checks passed`. Covers active, synchronized Registry 2.0 runtime bindings.
- [x] `pnpm typecheck` — passed on 2026-08-03 with no diagnostics. Covers compilation of the extraction, resolver, reader query, fixture changes, and typed launch-catalog definitions.
- [x] `openspec validate eh-113-cover-cbc-launch-catalog-special-cases --strict` — passed on 2026-07-30: `Change 'eh-113-cover-cbc-launch-catalog-special-cases' is valid`.
- [ ] `pnpm test:registry-v2-candidate-corpus` — blocked on 2026-08-03 only by hash-bound release approvals. The typed-catalog report now has 100% raw preservation, recognition, expected-classification, alias, and unit coverage; zero false concrete resolutions; zero processing errors; and no uncovered rows. All threshold checks pass for candidate input `98c4e2e97b83a0cc0cca0aaecfa6a6003624ee9c5e01bbdff6152a24f03c5050`. The candidate remains non-launchable until fresh approvals for that exact hash are supplied by the Registry Safety Reviewer, Assessment Owner for `alt_serum_catalytic_activity` and `glucose_serum`, and Release Manager. Do not alter approval hashes without those reviews.
- [x] Local disposable database verification — passed on 2026-07-30. `npx supabase start` applied migrations `001`–`034`, including `034_eh113_cbc_method_evidence.sql`. With `C:\Program Files\Docker\Docker\resources\bin` prepended to the Windows `PATH`, `npx supabase test db --local supabase/tests/eh113_cbc_method_evidence.sql` passed: `Files=1, Tests=4, Result: PASS`. It proves that `document_extracted_biomarkers.method` exists, remains nullable, accepts `manual`, and rejects unsupported method evidence.
- [x] The local disposable run proves migration `034_eh113_cbc_method_evidence.sql` applies cleanly and enforces its database contract. The remote sandbox remains out of sync at migration `024`; it is not used as EH-113 verification evidence.
- [ ] The reviewer must confirm that only an active synchronized, reviewed, resolved revision is consumed at the read, conversion, and readiness boundaries. `npm run test:eh113` and `npm run test:registry-v2-runtime` provide automated evidence; this internal contract is not manually tested.

## Out of scope or not manually testable yet

- The final EH-112 UI/API presentation for incomplete resolver evidence is out of scope. If the current build does not expose a partial or ambiguous label, mark EH113-UI-03 and EH113-UI-04 as **Blocked**, not passed.
- Clinical review of new aliases beyond the reviewed fixture matrix, glucose work (EH-114), durable trace support (EH-115), and cross-domain synthesis (EH-116) are out of scope.
- Database constraint behavior and candidate-evidence safety are not manually testable without developer evidence.
