## Why

Registry 2.0 already has valuable unit ontology, structured resolver evidence, append-only corrections, and reproducible release machinery. The previous rollout plan compared it with Registry v1 in shadow mode because Registry v1 was assumed to be an active production contract. EH-102 now establishes a pre-launch hard cutover and a single launch catalog, so legacy-vs-new shadow comparison and a rollback feature flag no longer measure the right risk.

Readiness must instead prove that the launch registry behaves safely on representative documents: raw data is always retained, expected tests are recognized, false concrete resolution is prevented, manual decisions survive reprocessing, and score-affecting bindings are reviewed.

## What Changes

- Retain and complete explicit unit ontology, structured aliases, candidate evidence, independent mapping confidence, append-only corrections, and deterministic release manifests.
- Align governance with EH-102 maturity and `resolved | ambiguous | partial | unmapped` states.
- Replace legacy `canonicalKey`/`scoreRole` promotion invariants with concrete measurement identity and reviewed assessment-binding invariants.
- Replace Registry v1 shadow comparison with launch-corpus evaluation over exact labels, units, contexts, value kinds, and negative fixtures.
- Require separate thresholds for recognition, concrete resolution, false resolution, partial/ambiguous behavior, raw preservation, manual corrections, processing failures, and assessment impact.
- Keep automatic activation disabled for provisional, partial, ambiguous, unmapped, review-required, or score-affecting unapproved changes.
- Remove legacy feature-flag rollback as a production strategy; pre-launch rollback is a coordinated code/database reset to the prior development release.

## Capabilities

### New Capabilities

- `measurement-registry-governance`: Reproducible launch releases, mapping classification, corpus evidence, promotion rules, and approval ownership.

### Modified Capabilities

- `biomarker-catalog`: Structured aliases and unit ontology participate in maturity and launch coverage.
- `document-processing`: Resolver evidence and confidence support partial recognition without false concrete mapping.
- `document-extraction-review`: Manual correction remains append-only, reversible, evidence-constrained, and protected during reprocessing.

## Impact

- Existing unit, evidence, revision, and manifest implementation remains useful.
- Legacy-difference telemetry and rollout flags must be removed or replaced with corpus-run telemetry.
- Launch readiness depends on EH-102's sample fixture plus additional de-identified representative documents, not on agreement with Registry v1.
- Assessment formulas and score-required groups remain unchanged, but their inputs migrate to reviewed assessment bindings.
