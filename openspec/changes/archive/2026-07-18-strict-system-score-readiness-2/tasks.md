## 1. Align Existing Governance with the Hard Cutover

- [ ] 1.1 Replace legacy canonical-key compatibility in registry types, manifests, and promotion policy with EH-102 semantic identity and assessment bindings.
- [ ] 1.2 Add maturity and partial-state handling to structured evidence, confidence, revisions, APIs, and UI.
- [ ] 1.3 Remove legacy feature flags, difference telemetry, and rollback assumptions from governance code and documentation.

## 2. Unit Ontology and Resolver Evidence

- [x] 2.1 Separate raw unit aliases, normalized units, dimensions, canonical units, and conversion policies.
- [x] 2.2 Reject incompatible unit dimensions before selection and convert values only after concrete resolution.
- [x] 2.3 Persist candidate-level accepted/rejected evidence with stable codes.
- [x] 2.4 Keep extraction confidence independent from mapping confidence and deterministic confidence bands.
- [ ] 2.5 Verify partial recognition performs no definition-specific conversion and exposes missing axes.

## 3. Manual Review Governance

- [x] 3.1 Preserve manual verification, correction, and undo through append-only revisions.
- [x] 3.2 Prevent reprocessing from silently superseding active manual decisions.
- [x] 3.3 Restrict standard manual choices using explicit hard evidence.
- [ ] 3.4 Update review UX so partial/unmapped raw acceptance never forces an unstated specimen or method.
- [ ] 3.5 Add integration tests for correction, blocked incompatible selection, undo, reprocessing, and review-required assessment changes.

## 4. Registry Release Discipline

- [x] 4.1 Canonically serialize complete registry content and generate a deterministic cryptographic digest.
- [x] 4.2 Generate release metadata, changed-record inventory, mapping classifications, and regression fixture results.
- [ ] 4.3 Extend manifests and diffs with maturity, partial-recognition policy, assessment bindings, source provenance, and corpus coverage.
- [ ] 4.4 Reject unclassified, missing-fixture, or unapproved score-affecting changes in CI.

## 5. Launch Corpus Evaluation

- [ ] 5.1 Replace legacy shadow comparison with a non-mutating candidate-release corpus runner.
- [ ] 5.2 Include all 44 sample PDF rows plus exact label/unit/value-kind and missing-context negative fixtures.
- [ ] 5.3 Add representative de-identified documents across target panels, languages, laboratories, and specialty rows.
- [ ] 5.4 Report raw preservation, recognition, resolved/partial/ambiguous/unmapped, false resolution, alias/unit coverage, processing errors, manual corrections, and assessment impact separately.
- [ ] 5.5 Define numerical gates and approval ownership from the representative corpus; keep launch/promotion blocked until approved.

## 6. Final Verification

- [ ] 6.1 Prove corpus runs do not mutate active observations, revisions, trends, readiness, scores, or manual decisions.
- [ ] 6.2 Review every score-affecting binding and all sampled false/partial/ambiguous outcomes.
- [ ] 6.3 Run registry, resolver, unit, observation, review, trends, reports, health-profile, typecheck, and production-build suites.
- [ ] 6.4 Publish the candidate launch manifest, coverage report, approvals, and rollback/reset notes.
