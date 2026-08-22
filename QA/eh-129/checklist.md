# EH-129: Repeated measurement comparison

**Roadmap status:** Delivered
**Build / environment:** Windows 11 Pro; local Supabase; `pnpm build` with non-secret validation placeholders
**Test run date:** 2026-08-22
**Tester:** Implementation verification (automated checks plus authenticated local browser smoke)

## What this checklist covers

EH-129 adds a safe repeated-measurement comparison to the **Biomarkers** screen. It compares only current numeric observations with the same resolved Registry 2.0 measurement definition, keeps unit variants separate when no reviewed conversion is available, preserves each laboratory's native range and source, and supports an inclusive observation-date range. Factual observations remain available in the table even when they are not eligible for a numeric comparison.

## Before you start

- [ ] Use a dedicated EasyHealth test account with one active profile.
- [ ] Use only synthetic or de-identified laboratory documents; do not upload real patient records.
- [ ] Prepare two synthetic lab reports for the same resolved measurement definition from different laboratories. Give them different observation dates, units where a reviewed conversion exists, and different native reference ranges.
- [ ] Prepare synthetic observations for two different definitions with similar display names (for example, RDW-CV and RDW-SD).
- [ ] Prepare one synthetic qualitative or unresolved result and one unit variant with no reviewed conversion, if the test environment has those reviewed fixture states.
- [ ] Confirm the normal-path documents have finished processing and their observations are current before testing the comparison.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH129-COMPAT-01` | Synthetic lab A and lab B observations with the same resolved measurement definition, different native units supported by a reviewed conversion, dates `2026-01-10` and `2026-01-20`, and different native ranges. | One normalized series with per-point provenance. |
| `EH129-DEFINITION-01` | Synthetic RDW-CV and RDW-SD observations, both numeric and resolved but with different definition keys. | Prevent incompatible definitions from mixing. |
| `EH129-UNIT-01` | Synthetic observations for one definition in two units where no reviewed conversion binding is available. | Keep unsafe unit variants in separate series. |
| `EH129-INCOMPLETE-01` | Synthetic qualitative and unresolved/partial observations with current factual rows. | Keep factual results visible without plotting them. |
| `EH129-RANGE-01` | A date range containing no observations for the selected series, such as `2027-01-01` through `2027-01-31`. | Filtered-empty state and clear-range action. |

**Executed local fixture set (2026-08-22):** `EH129-HGB-GDL-2026-08-15.pdf`, `EH129-HGB-GL-2026-08-21.pdf`, `EH129-MCV-UM3-2026-08-22.pdf`, `EH129-RDW-CV-2026-08-24.pdf`, `EH129-RDW-SD-2026-08-25.pdf`, `EH129-RDW-UNRESOLVED-2026-08-26.pdf`, and `EH129-QUALITATIVE-2026-08-27.pdf` were inserted into the dedicated local profile through the service normalization writer and deleted after the smoke run. All rows used synthetic, de-identified source text.

## Interface checks

### EH129-UI-01: Open the compatible comparison

**Precondition:** `EH129-COMPAT-01` is processed for the active profile and both observations have the same resolved measurement definition.

1. Open **Biomarkers** from the authenticated application navigation.
2. Review the factual observation table and confirm both synthetic source rows remain visible.
3. In **Repeated measurement comparison**, open the series selector.
4. Select the series for `EH129-COMPAT-01`.
5. Review the line and the **Point evidence** list.

**Expected result:** Both observations appear in one chronological series only when the API presents one common reviewed display unit. The comparison identifies the selected measurement series and does not remove the source rows from the table.

**Result:** `Passed`
**Notes / evidence link:** Authenticated local browser smoke selected `Hemoglobin · g/L`; the 2026-08-13, 2026-08-15, and 2026-08-21 observations appeared in one chronological series while the factual table retained all source rows.

### EH129-UI-02: Verify guarded unit behavior

**Precondition:** `EH129-COMPAT-01` has a reviewed conversion binding; `EH129-UNIT-01` is available with no reviewed conversion binding.

1. Select the compatible series from `EH129-COMPAT-01`.
2. Change the profile's **Units** preference between **SI** and **US**, waiting for the observations to reload after each change.
3. Confirm the selected compatible series uses the server-presented display unit and the comparison message states when values are normalized through a reviewed binding.
4. Select each unit-specific series from `EH129-UNIT-01`.
5. Compare their labels and units.

**Expected result:** Reviewed, server-supplied conversion may put compatible unit variants on one displayed-unit axis while preserving the native lab values. Unit variants without a reviewed conversion remain separate series; the browser never shows an inferred conversion between them.

**Result:** `Passed`
**Notes / evidence link:** SI and US reloads both normalized the compatible Hemoglobin fixtures (`g/L` ↔ `g/dL`) while preserving the selected Hemoglobin series, date range, and native values/ranges. `Mean corpuscular volume · fL` and `Mean corpuscular volume · µm3` appeared as separate series with no inferred conversion.

### EH129-UI-03: Check native range and source navigation per point

**Precondition:** The selected compatible series has two points with different native ranges and source documents.

1. Review both rows in **Point evidence**.
2. Compare each **Lab value** and **Native range** with the corresponding synthetic source report.
3. Activate **Open source** for the first point using the keyboard or pointer.
4. Confirm the document viewer opens the matching source document.
5. Return to **Biomarkers** and repeat the source action for the second point.

**Expected result:** Each point shows its own document-native value, unit, and reference range; no one global range is shown for all points. Every source action opens the corresponding owned document viewer, not an unrelated document.

**Result:** `Passed`
**Notes / evidence link:** Point evidence showed the per-point native ranges (`13–17.5 g/dL` and `130–170 g/L`). `Open source` opened both `EH129-HGB-GDL-2026-08-15.pdf` and `EH129-HGB-GL-2026-08-21.pdf` in their matching document viewers.

### EH129-UI-04: Apply inclusive observation-date selectors

**Precondition:** `EH129-COMPAT-01` contains observations on `2026-01-10` and `2026-01-20`.

1. Enter `2026-01-10` in **From**.
2. Enter `2026-01-20` in **To**.
3. Review the selected comparison and its point evidence.
4. Change **From** to `2026-01-11`.
5. Clear both date fields with **Clear range**.

**Expected result:** Both boundary observations are included in the first range. The `2026-01-10` point is excluded after the later start date. Clearing the range restores both points and does not change the factual observation table.

**Result:** `Passed`
**Notes / evidence link:** With From `2026-08-15` and To `2026-08-21`, both boundary points were included. Changing From to `2026-08-16` removed the 2026-08-15 point; Clear range restored the full series without changing the table.

### EH129-UI-05: Keep incompatible or incomplete observations out of lines

**Precondition:** `EH129-DEFINITION-01`, `EH129-UNIT-01`, and `EH129-INCOMPLETE-01` are visible in the active profile.

1. Open the comparison series selector.
2. Confirm RDW-CV and RDW-SD appear as separate definitions/series.
3. Confirm unsafe unit variants are separate unit-specific series.
4. Review the factual table for the qualitative and unresolved rows.
5. Check that neither incomplete row appears as a numeric comparison point.

**Expected result:** Similar labels or analytes do not cause different definition keys to share a line. Unsafe unit variants are not plotted together. Qualitative and unresolved facts remain inspectable in the table but are not represented as numeric trend values.

**Result:** `Passed`
**Notes / evidence link:** The selector exposed `RDW-CV · %` and `RDW-SD · fL` as separate series; each Point evidence list contained only its own synthetic point. The unresolved `RDW` and qualitative `Ascaris IgG antibodies` remained visible in the factual table, but neither appeared as a comparison series or point.

### EH129-UI-06: Handle a date range with no points

**Precondition:** `EH129-RANGE-01` is outside every point date in the selected series.

1. Select a series with known points.
2. Enter the `EH129-RANGE-01` From and To dates.
3. Review the comparison card.
4. Select **Clear range**.

**Expected result:** The comparison card says that no measurements match the selected range and provides **Clear range**. It does not claim that the profile has no factual observations. Clearing the range restores the eligible points.

**Result:** `Passed`
**Notes / evidence link:** A range outside the selected MCV `µm3` point (`2026-09-01` through `2026-09-02`) rendered “No measurements match the selected date range” with Clear range; clearing restored the point. The authenticated local browser smoke used the populated fixtures listed above.

## Developer evidence required

- [x] Engineering provides `pnpm test:eh129` output proving exact-definition separation, reviewed conversion grouping, unsafe-unit separation, native ranges, date boundaries, exclusions, source hrefs, and page/API seams.
- [x] Engineering provides `pnpm typecheck` output proving the comparison projection, API source relation, chart evidence ledger, and Biomarkers page compile.
- [x] Engineering provides `pnpm build` output proving the existing authenticated route still registers and the new client comparison imports compile in a production build.
- [x] Engineering confirms `/api/biomarkers` remains profile-scoped and continues to call `projectActiveRegistryV2LaboratoryBinding`/`presentObservation`; no browser-side conversion is accepted as evidence.
- [x] Engineering confirms native ranges come from the per-observation `original_ref_low`/`original_ref_high` fields and source links target the observation's document id.
- [x] Engineering confirms no database migration, RPC, or write path was introduced; no `test:eh129-db` check is applicable.

## Out of scope or not manually testable yet

- Registry definitions, aliases, unit policies, conversion formulas, resolver outcomes, and assessment eligibility are not changed by EH-129; validate those contracts through their existing Registry/EH-111 checks.
- Database persistence, profile isolation at the SQL boundary, and active-revision provenance are not new EH-129 write contracts; use the existing API and database evidence rather than claiming them as UI-passed.
- A request-failure/offline state for the existing Biomarkers endpoint is not introduced by this change. Do not mark an unavailable failure fixture as passed; record `Blocked` or `N/A` with the environment limitation.
- Points without a valid observation day are intentionally not plotted because this comparison does not invent dates; they remain subject to the existing factual observation behavior.
