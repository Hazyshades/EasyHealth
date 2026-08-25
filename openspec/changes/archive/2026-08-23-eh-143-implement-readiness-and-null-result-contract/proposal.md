## Why

A Health Profile current-state score must represent a complete, usable minimum evidence set—not a partial average or a stale cached assessment. The existing aggregation has group-aware pieces, but its public contract does not provide one canonical machine-readable reason for an unavailable score, and a queued recalculation can expose an outdated persisted score.

## What Changes

- Make score readiness a canonical, deterministic result for every named body system: every approved required group must be satisfied by one usable alternative before `state_score` may be numeric.
- Replace the overlapping readiness projections (`missing_groups` and `present_without_reference`) with ordered, machine-readable readiness reasons. Each unsatisfied required group is classified as `missing` when no accepted candidate is present or `invalid` when candidates are present but unusable.
- Preserve reviewed Registry 2.0 readiness-group membership as the runtime authority. Alternatives remain within one group; a context-only or contribution-only input cannot satisfy another group.
- Return `null` for every unavailable named-system score and for the overall score; delete the unreachable soft-score fallback so unavailable evidence can never become a partial average or `0`.
- Suppress persisted numeric scores when their recalculation job indicates that the snapshot is outdated, and expose the stable `outdated` reason code instead of presenting stale data as current.
- Add focused EH-143 executable coverage for all eight named systems, alternatives, missing and invalid groups, outdated persisted assessments, and overall-score behavior; add the roadmap QA checklist.

## Capabilities

### New Capabilities
- `health-profile-score-readiness`: Deterministic Health Profile score-readiness and null-result API contract, including group-level reasons and stale-assessment suppression.

### Modified Capabilities
- None.

## Impact

- Target domain: `health-profile`.
- Affected aggregation and response contracts: `src/lib/health-systems.ts`, `src/lib/health-profile-snapshot.ts`, and `src/app/api/health-profile/route.ts`.
- Affected first-party presentation: `src/components/health-profile-drawer.tsx` and Health Profile response consumers.
- Affected verification: a focused `scripts/verify-eh143-readiness.ts` runner and package script.
- No database migration, Registry membership change, clinical recommendation, or biological age threshold is introduced. `outdated` means the persisted assessment snapshot is superseded by a non-succeeded recalculation job, not that a laboratory result is medically stale.
