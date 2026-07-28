## 1. Alias authority contract

- [x] 1.1 Replace the implicit `MeasurementAlias` shape with validated `AliasDefinition`, provenance, lifecycle, match-authority, bounded-fuzzy, and matched-admission types.
- [x] 1.2 Extend resolution input and candidate evidence contracts with laboratory attribution and matched alias identity without adding EH-109 scoring policy.
- [x] 1.3 Build the single active alias-admission index with exact, normalized, explicit OCR, laboratory-scoped, and bounded-fuzzy matching; reject unsupported catalog invariants.

## 2. Catalog and corpus cutover

- [x] 2.1 Replace the generic alias factory and migrate reviewed Registry 2.0 aliases to explicit authority records with source and review references.
- [x] 2.2 Add a versioned de-identified launch-corpus descriptor and migrate fixture aliases with stable fixture ownership and recognition-only authority.
- [x] 2.3 Remove direct normalized-string alias comparisons, implicit reviewed defaults, and every legacy alias-admission path.

## 3. Manifest and resolver integration

- [x] 3.1 Route resolver candidate collection through alias admission and enforce authority/lifecycle eligibility for concrete reviewed candidates.
- [x] 3.2 Serialize the complete alias authority contract in the deterministic release manifest and update digest/version behavior.
- [x] 3.3 Classify alias authority, scope, lifecycle, provenance, fixture, and matching-policy changes as review-required or breaking according to the specification.

## 4. Regression evidence and QA

- [x] 4.1 Add catalog validation and resolver tests for reviewed, provisional, deprecated, scoped, and definition-maturity authority outcomes.
- [x] 4.2 Add bounded-fuzzy boundary and launch-corpus negative-authority regressions for foreign-laboratory, fixture-only, unapproved-fuzzy, and over-distance inputs.
- [x] 4.3 Add manifest serialization, digest, and change-classification regression coverage.
- [x] 4.4 Update `QA/eh-110/checklist.md` with tester-visible limitations and developer evidence requirements; run the focused biomarker and CBC regression commands.