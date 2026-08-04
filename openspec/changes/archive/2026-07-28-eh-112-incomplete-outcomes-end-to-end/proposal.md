## Why

EH-111 now produces clinically safe `resolved`, `partial`, `ambiguous`, and `unmapped` outcomes, but the product still treats incomplete semantic identity inconsistently across document APIs, review UI, biomarker trends, and Health Profile assessment. EH-112 is required now so recognized-but-incomplete, conflicting, and unknown laboratory rows remain visible and reprocessable without being guessed into a concrete identity or silently affecting trends and scores.

## What Changes

- Define one active-revision laboratory outcome DTO for all four resolver outcomes, with raw evidence always preserved and concrete analyte/measurement identity nullable unless an active `resolved` reviewed binding passes the EH-111 read boundary.
- Expose stable, privacy-safe technical details for incomplete rows: outcome, verification state, mapping confidence, missing axes, conflict/evidence summaries, resolver/catalog versions, and candidate count without presenting a candidate key as active identity.
- Add explicit English UI states and guidance for `partial`, `ambiguous`, and `unmapped` rows in the document review surface while retaining raw label, value, unit, reference range, specimen, and source provenance.
- Keep incomplete rows available through the existing document-level **Reprocess** workflow and preserve append-only extraction and normalization history; targeted revision management remains outside EH-112.
- Enforce consumer safety: only active `resolved` reviewed measurement definitions enter definition-specific trends, and only active reviewed assessment-compatible bindings affect Health Profile readiness, confidence, or scores.
- Add privacy-safe outcome and exclusion metrics plus end-to-end fixtures covering API serialization, document presentation, reprocessing visibility, trend exclusion, and assessment exclusion.
- Preserve EH-104/EH-106 writer and projection primitives and consume the EH-111 outcome/evidence contract rather than creating a second resolver, candidate selector, or fallback identity path.

## Capabilities

### New Capabilities

- `incomplete-laboratory-outcomes`: End-to-end API, UI, reprocessing visibility, trend/assessment safety, observability, and regression behavior for `partial`, `ambiguous`, and `unmapped` laboratory outcomes.

### Modified Capabilities

- None. EH-112 consumes the existing `context-aware-measurement-resolution` contract without changing resolver eligibility, evidence, or outcome selection.

## Impact

- **Domains:** documents and health-profile.
- **Runtime:** active normalization revision projection, document observation DTOs, document extraction/review UI, Biomarkers API and trend series, Health Profile assessment inputs, and document reprocessing visibility.
- **Contracts:** four-state serialization, nullable identity, raw-evidence fields, technical-detail summaries, consumer eligibility, exclusion reasons, and privacy-safe aggregate metrics.
- **Data:** no new semantic identity writer and no rewrite of historical revisions; additive storage or views are permitted only when needed for aggregate metrics.
- **Verification:** API/component fixtures, active-revision boundary regressions, document-level reprocess smoke coverage, trend/assessment negative cases, and an end-to-end four-outcome corpus.
- **Dependencies:** requires the merged EH-111 compatibility/read-boundary contract and builds on EH-104 active-revision projection plus EH-106 acceptance/reprocessing integration.
