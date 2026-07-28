## Why

The current Registry 2.0 resolver compares normalized labels and a limited set of axes, then derives a score and confidence solely from the terminal outcome. It can therefore treat unverified aliases as equivalent and cannot explain or safely distinguish compatible, incomplete, and conflicting evidence across the context supplied by a laboratory result.

EH-109 establishes a deterministic, evidence-derived resolution contract before the incomplete-state consumers and clinical scenario packs depend on its persisted output.

## What Changes

- Introduce a context-aware measurement-resolution capability that evaluates reviewed and provisional Registry 2.0 candidates against authorized label matches, value kind, unit family, specimen, modifier, timing, method, section/panel context, neighbouring rows, and reference-range shape.
- Define structured accepted, missing, and hard-conflicting evidence; use an explicit scoring policy, confidence bands derived from that evidence, and a stable tie policy.
- Preserve the four resolver outcomes without forcing incomplete recognition into a concrete identity: only a unique, fully compatible reviewed candidate resolves; ties remain ambiguous; known but incomplete or provisional candidates remain partial; unrecognized labels remain unmapped.
- Persist the complete resolver decision trace, candidate evidence, outcome, mapping confidence, catalog manifest version, and resolver version through the existing normalization revision writer and review DTO.
- Require the EH-110 alias authority and lifecycle contract before enabling authority-sensitive matching so the resolver consumes approved, non-deprecated aliases rather than ad-hoc normalized strings.
- Add deterministic unit, corpus, and persistence regression coverage, including reviewed/provisional, conflict, partial, ambiguous, and negative-authority cases.

## Capabilities

### New Capabilities
- `context-aware-measurement-resolution`: Deterministic, provenance-aware candidate generation, evidence scoring, outcome selection, confidence calculation, and normalization-trace persistence for document-extracted laboratory rows in the `documents` domain.

### Modified Capabilities

None. `openspec/specs/` has no existing capability specifications to modify.

## Impact

- `src/lib/biomarkers/types.ts` and `src/lib/biomarkers/measurement-resolution.ts`: input, evidence, authority, scoring, and deterministic-selection contracts.
- `src/lib/documents/normalization-policy.ts`, `src/lib/documents/normalization-review.ts`, `src/lib/documents/observation-normalization-writer.ts`, and normalization revisions: compatible manual selections, persisted evidence, and review DTOs.
- Registry 2.0 launch fixtures, resolver tests, normalization persistence tests, and the existing `pnpm test:biomarkers` regression floor.
- EH-110 is an implementation sequencing dependency for alias authority; EH-111, EH-112, EH-113, EH-114, EH-115, and EH-116 consume this contract and remain out of scope.