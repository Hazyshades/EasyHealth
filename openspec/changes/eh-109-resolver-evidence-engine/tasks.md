## 1. Evidence contract and policy

- [ ] 1.1 Complete EH-110 alias-admission integration and add typed resolver inputs for timing, method, laboratory, value kind, and structured reference shape.
- [ ] 1.2 Define the validated `evidence-1` policy, typed decision envelope, candidate scores/confidence, hard conflicts, missing axes, and reason codes.
- [ ] 1.3 Implement the pure candidate evaluator with the fixed evidence weights, 70-point qualification threshold, eight-point margin rule, and stable output ordering.

## 2. Resolver and verification integration

- [ ] 2.1 Replace accepted-evidence counting and outcome constants in the Registry 2.0 resolver with policy-derived scores, conflicts, confidence, and four-state selection.
- [ ] 2.2 Update normalization policy and manual-correction validation to consume candidate eligibility and retain calculated confidence without fixed overrides.
- [ ] 2.3 Remove direct string/proposed-key candidate creation and all legacy resolver scoring paths.

## 3. Revision persistence and document DTOs

- [ ] 3.1 Add additive evidence-policy-version persistence for extracted biomarkers and normalization revisions without rewriting historic revisions.
- [ ] 3.2 Persist the decision envelope through the atomic writer and include every policy input in evidence/request hashes.
- [ ] 3.3 Update normalization-review and document-detail DTOs to expose active evidence-policy version, ordered candidates, alias provenance, scores, conflicts, missing axes, and decision fields.

## 4. Regression evidence and QA

- [ ] 4.1 Add pure resolver fixtures for every evidence axis, reviewed/provisional authority, hard conflict, missing-axis, threshold, decisive-margin, and close-tie outcome.
- [ ] 4.2 Add writer and migration/API tests for immutable historic revisions, versioned envelope persistence, hash changes, manual-correction conflict rejection, and active projection invariants.
- [ ] 4.3 Update `QA/eh-109/checklist.md` with manual limitations and developer evidence requirements; run focused biomarker, database/writer, and CBC regression commands.