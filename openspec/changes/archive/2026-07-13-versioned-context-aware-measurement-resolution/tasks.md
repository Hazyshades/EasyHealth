## 1. Static Registry and Resolver

- [x] 1.1 Add versioned `MeasurementDefinition` types, registry manifest version/digest, compatibility policy, resolver result types, and verification status types without changing existing canonical catalog keys.
- [x] 1.2 Define the initial measurement definitions and context constraints for absolute/percentage neutrophils and lymphocytes, RDW-CV/RDW-SD, absolute/percentage reticulocytes, serum/plasma and whole-blood glucose, urine glucose, fasting glucose, and segmented/band neutrophils.
- [ ] 1.3 Add unit-token normalization and candidate filtering that applies hard unit/specimen/modifier constraints before aliases, section context, neighbour evidence, and reference-shape tiebreakers.
- [ ] 1.4 Implement deterministic context-aware resolution with `resolved`, `ambiguous`, and `unmapped` outcomes; keep extraction confidence and mapping confidence independent.
- [ ] 1.5 Add resolver unit tests for precedence, missing context, conflicting units, fasting non-inference, OCR aliases at high/low confidence, and deterministic output for a fixed registry/resolver version.

## 2. Normalization Audit Data and Compatibility

- [x] 2.1 Add additive migrations for measurement-definition metadata on extracted/active observations and an append-only `observation_normalization_revisions` table with evidence hash, versions, resolver result, verification status, promotion, and supersession fields.
- [ ] 2.2 Implement revision persistence and promotion services that preserve immutable extracted evidence, create candidate revisions on reprocessing, and materialize active observations only from promoted revisions.
- [ ] 2.3 Add legacy compatibility behavior for observations without revisions, explicit `measurement_definition_key` to legacy `biomarker_key` mappings, and safeguards against unsafe key collapse.
- [ ] 2.4 Implement controlled reprocessing that creates candidates, detects identity/assessment-eligibility changes, supports rollback to a prior active revision, and never rewrites active history in place.
- [ ] 2.5 Add migration and repository integration tests for append-only behavior, active revision uniqueness, legacy fallback, explicit promotion, supersession, and rollback.

## 3. Document Pipeline and Review

- [ ] 3.1 Preserve raw label/value/unit/range and available section context on extraction rows; treat LLM-proposed keys as non-authoritative resolver input.
- [ ] 3.2 Route extraction and acceptance through the new resolver, creating normalization candidates rather than direct alias-only observation upserts.
- [ ] 3.3 Extend document biomarker APIs with resolver evidence, candidate definition, mapping confidence, revision state, and allowed manual-correction options.
- [ ] 3.4 Update extraction review UI to show resolver state/evidence, support user verification and manual correction, and distinguish pending, ambiguous, unmapped, and promoted records.

## 4. Consumer Safety and Feature Rollout

- [ ] 4.1 Add a feature flag and shadow-mode metrics/logging that compare legacy alias resolution with the new resolver without changing active observations or assessment output.
- [ ] 4.2 Update Biomarkers overview grouping and trend selection to keep incompatible measurement definitions and unresolved observations out of mixed normalized series while retaining factual display.
- [ ] 4.3 Update health-profile aggregation and API serialization to use only active, resolved, assessment-compatible normalized observations while preserving the legacy fallback during rollout.
- [ ] 4.4 Add regression coverage proving urine glucose, ambiguous required aliases, inactive candidates, and superseded revisions cannot affect readiness, confidence, or numeric scores.

## 5. Verification and Rollout Readiness

- [ ] 5.1 Add end-to-end fixtures for all required differential, RDW, reticulocyte, glucose, fasting, missing-unit, incompatible-unit, and OCR-confidence cases.
- [ ] 5.2 Run database migration checks, resolver/unit tests, document extraction-review tests, biomarker overview tests, health-profile regression tests, type checks, and production build.
- [ ] 5.3 Run shadow mode against a representative staged corpus, review resolver-difference metrics and sampled candidates, and document the promotion criteria before enabling compatibility-preserving auto-promotion.
