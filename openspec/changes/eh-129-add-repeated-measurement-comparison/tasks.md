## 1. Comparison contract

- [x] 1.1 Add the pure repeated-measurement comparison types, exact-definition grouping, display-unit bucketing, native evidence projection, and deterministic point ordering.
- [x] 1.2 Add inclusive date-range filtering and explicit normalized/native series metadata without performing client-side unit conversion.
- [x] 1.3 Extend the profile-scoped Biomarkers API source relation with laboratory identity while preserving active-resolution, conversion-eligibility, displayed-value, and native-range fields.

## 2. Biomarkers comparison interface

- [x] 2.1 Extend the trend chart with per-point native value/range metadata and keyboard-operable source-document links.
- [x] 2.2 Add the exact series selector, normalized/native unit messaging, From/To date selectors, clear-range action, and filtered-empty state to the Biomarkers page without changing factual table filters.
- [x] 2.3 Keep incompatible definitions, unsafe unit variants, unresolved rows, and qualitative rows out of plotted numeric series while retaining them in the existing table response.

## 3. Verification and roadmap evidence

- [x] 3.1 Add deterministic EH-129 verification coverage for definition separation, conversion guard behavior, native ranges, date boundaries, exclusions, source links, endpoint seams, and page controls; register `test:eh129`.
- [x] 3.2 Create `QA/eh-129/checklist.md` with synthetic-data interface checks, native-range/source-navigation coverage, developer evidence, and explicit unavailable/deferred behavior.
- [x] 3.3 Validate OpenSpec artifacts, run focused EH-129 verification plus typecheck/build, and record the result without claiming unsupported database/UI coverage.
- [x] 3.4 Confirm Registry canonical docs/generated outputs are unchanged by this presentation-only consumer change, or perform the required Registry documentation synchronization if runtime Registry surfaces are altered.
