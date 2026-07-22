# Measurement Registry Rollout

## Shadow Metrics

## EH-102 identity invariants

An analyte is a stable family identifier, not a storage key and not proof that two measurements are interchangeable. A measurement definition has one explicit identity tuple: analyte, specimen, property, scale, timing, and method. `unspecified` records missing legacy evidence; it is never a wildcard or positive compatibility signal. `canonicalKey` is only a Registry v1 compatibility mapping.

Curated definitions are the authoritative context-aware candidates. The legacy adapter provides deterministic representability for all frozen Registry v1 keys, but adapter coverage is not clinical curation or equivalence. Registry v1 artifacts remain frozen; use the erratum/new-baseline process for corrections.

The shadow rollout records one immutable event per candidate resolution, manual correction, promotion rejection, or processing failure. Review the following metrics by definition, normalized unit, unit dimension, specimen, modifier, source laboratory when available, and document type:

- resolution, ambiguous, and unmapped rates;
- legacy versus Registry 2.0 mapping difference rate;
- score-impacting difference rate;
- manual correction rate;
- processing error rate;
- mapping-confidence-band distribution;
- automatic-promotion rejection reasons.

## Approval Ownership

The engineering owner prepares the staged-corpus report. The product owner approves the initial automatic-promotion mapping classes. A reviewer samples the score-impacting differences and all mappings that would change identity, specimen, modifier, or assessment compatibility.

## Baseline And Gates

Before `EASYHEALTH_MEASUREMENT_RESOLUTION_MODE=promote` is enabled, collect a representative staged corpus that includes the regression fixtures and real documents covering CBC differentials, RDW, reticulocytes, glucose specimen variants, fasting labels, missing units, incompatible units, and OCR variants.

Document numerical thresholds from that baseline in the rollout record. Thresholds cannot be copied from a different corpus. Automatic promotion stays disabled unless the report, thresholds, sampled review, and rollback owner are recorded.

## Rollback

Set `EASYHEALTH_MEASUREMENT_RESOLUTION_MODE=off` to stop new candidates and promotion, or `shadow` to continue collecting evidence without mutating active observations. Existing raw evidence, candidate revisions, and telemetry remain available for audit.
