## Why

The Biomarkers overview currently offers a value-only trend grouped by an exact Registry 2.0 definition, but it does not explain which native laboratory range or source belongs to each point and has no period selector. EH-129 needs a safe repeated-measurement comparison now so users can compare one compatible measurement definition across reports and laboratories without mixing incompatible definitions or applying an unreviewed unit conversion.

## What Changes

- Add a pure repeated-measurement comparison model for numeric observations that are eligible for trends and have an active resolved measurement definition.
- Group points by the exact `measurement_definition_key`; keep different definitions (for example, RDW-CV and RDW-SD) in separate series even when their display names or analytes are similar.
- Keep unit variants in one series only when the API has already supplied a common display unit through the reviewed conversion binding; otherwise split them by native/display unit instead of guessing.
- Preserve each point's document-native value, unit, reference low/high range, observed date, laboratory/document source, and source-document link alongside the displayed comparison value.
- Add inclusive From/To date selectors and an explicit series selector to the Biomarkers trend panel; filtering is local to the comparison and does not hide factual observations from the table.
- Extend the trend visualization with per-point native ranges and accessible source-document navigation.
- Add deterministic EH-129 verification coverage and a roadmap QA checklist. No database migration or new persistence path is introduced.

## Capabilities

### New Capabilities

- `repeated-measurement-comparison`: Safe profile-scoped comparison of compatible resolved laboratory measurements with native provenance, guarded units, date filtering, and source navigation.

### Modified Capabilities

- None. The change consumes the existing `context-aware-measurement-resolution` and `incomplete-laboratory-outcomes` contracts; it does not alter resolver outcomes, Registry definitions, conversion policies, or consumer eligibility.

## Impact

- **Target domains:** `health-profile` (Biomarkers overview) and `documents` (source-document navigation and observation provenance).
- **Application:** `src/lib/biomarker-comparison.ts`, the Biomarkers page/chart, and the existing `/api/biomarkers` response fields needed for laboratory source identity.
- **Contracts:** exact-definition series identity, conversion eligibility as a hard guard, per-point native ranges, inclusive date filtering, and source links.
- **Verification:** pure TypeScript comparison matrix, static endpoint/page seam checks, typecheck/build evidence, and `QA/eh-129/checklist.md`.
- **Registry docs:** no catalog, alias, unit, resolver, or generated Registry data changes; existing runtime guard and generated documentation are intentionally reused unchanged.
