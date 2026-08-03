## 1. Compatibility Policy Contracts

- [x] 1.1 Extend resolver types with the `unit` missing axis, explicit missing/unsupported evidence codes, compatibility-policy metadata, and a pure compatible/missing/conflict result shape.
- [x] 1.2 Encode registry invariants for numeric versus display-only unit policies and reject contradictory value-kind/unit-policy definitions.
- [x] 1.3 Verify every current `allowedSpecimens` value duplicates the identity-bearing `specimen`, then remove `allowedSpecimens` from definitions, catalog construction, release serialization, and change classification.
- [x] 1.4 Implement table-driven pure evaluators for missing-unit policy, normalized unit family/token compatibility, numeric versus qualitative/ordinal value-kind compatibility, and canonical specimen compatibility.

## 2. Existing Resolver Integration

- [x] 2.1 Replace inline unit, value-kind, and specimen checks in the existing candidate evidence path with the pure policy evaluators; do not introduce a second matcher or alias-admission path.
- [x] 2.2 Emit structured compatible, missing, unsupported, and hard-conflict evidence with observed/expected values, including `unit_missing`, `value_kind_missing`, and `specimen_missing`.
- [x] 2.3 Tighten candidate eligibility so every definition-required unit, value-kind, specimen, modifier, timing, and method axis is complete before concrete selection while preserving recognized incomplete candidates as `partial`.
- [x] 2.4 Preserve the EH-109 score threshold, dominance margin, deterministic ordering, confidence derivation, and four resolver outcomes while bumping resolver and compatibility-policy versions.
- [x] 2.5 Confirm extraction supplies observed raw unit, value kind, and specimen without inference and that ordinal parser output reaches the compatibility policy unchanged.

## 3. Persistence, Read Boundary, and Conversion

- [x] 3.1 Propagate unit/value-kind/specimen dispositions, missing axes, conflicts, eligibility, and policy version through the append-only normalization decision trace and atomic active revision publication.
- [x] 3.2 Enforce at the normalization read boundary that only an active `resolved` revision exposes a non-null measurement definition key equal to its selected trace key.
- [x] 3.3 Add a resolved-reviewed-binding guard that requires active status, `resolved` outcome, selected-key equality, Registry 2.0 reviewed provenance, and reviewed conversion metadata.
- [x] 3.4 Migrate every conversion presentation consumer to the guarded binding and remove direct bare candidate-key conversion paths.
- [x] 3.5 Preserve historical revision interpretation without backfill; document the new catalog, resolver, normalization, trace, and compatibility-policy versions in generated release evidence.

## 4. Regression Matrix and Runtime Proof

- [x] 4.1 Add pure policy tests for `reject`, `ambiguous`, and `display_only` missing-unit behavior; accepted units; wrong families; rejected tokens; and unknown non-empty tokens.
- [x] 4.2 Add bidirectional percent-versus-absolute-count, numeric-versus-qualitative/ordinal, missing value-kind, qualitative-without-unit, and qualitative/ordinal equivalence tests.
- [x] 4.3 Add serum, plasma, whole-blood, urine, missing-specimen, and unknown-specimen tests proving missing is neither compatible nor conflicting and observed mismatches are hard conflicts.
- [x] 4.4 Add resolver outcome tests proving required missing axes remain `partial`, complete ties remain `ambiguous`, hard-conflicted candidates are evidence only, and only a unique complete reviewed leader becomes `resolved`.
- [x] 4.5 Add persistence/read DTO tests proving the active trace reproduces policy evidence and incomplete outcomes expose no concrete measurement definition key.
- [x] 4.6 Add conversion tests proving partial, ambiguous, unmapped, provisional, inactive, mismatched-trace, missing-axis, conflicted, and evidence-only candidate keys preserve native values and units.
- [x] 4.7 Run the launch resolver corpus and compatibility matrix together; require all existing launch fixtures to pass with zero false concrete resolutions.
- [x] 4.8 Smoke-test a resolved reviewed observation and an otherwise matching observation with missing clinical context through extraction, normalization publication, active read DTO, and display conversion.

## 5. QA and Delivery Evidence

- [x] 5.1 Create `QA/eh-111/checklist.md` from the roadmap template with safe synthetic/de-identified data, product-interface checks where available, an explicit note for unavailable incomplete-state UI, and separate developer-evidence requirements.
- [x] 5.2 Record targeted unit, resolver, persistence, read-boundary, conversion, registry-manifest, and launch-corpus evidence in the EH-111 QA checklist without marking unexecuted manual checks as passed.
- [x] 5.3 Validate the OpenSpec change, verify generated registry/release artifacts are deterministic, and run the affected project checks once after implementation.
- [ ] 5.4 Update GitHub issue #11 and roadmap status with the delivered acceptance matrix and CI evidence only after all implementation and QA completion gates pass.

  Blocked from delivery completion on 2026-07-28: the local implementation has no PR or merge, new hash-bound registry safety/assessment/release approvals are required for the changed digest, the live PostgREST test needs a disposable configured stack, and manual UI checks are unexecuted. Issue #11 checklist and evidence comment are current; the issue remains open and the Project item is correctly `In progress`.
