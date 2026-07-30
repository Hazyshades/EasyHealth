## Context

EH-109 returns rich in-memory `MeasurementResolution.candidateEvidence`; EH-106 already persists that untyped evidence array alongside a normalization revision through the service-only atomic writer. The document biomarker route nevertheless calls `resolveMeasurementDefinition` again in `buildNormalizationReview`, so its technical-details view explains the current registry and resolver rather than the historical decision.

EH-104 makes an active `observation_normalization_revisions` row authoritative and requires atomic synchronization with the observation projection. EH-103 makes source and release provenance write-once. EH-115 must extend that revision boundary without duplicating raw document text, raw values, section context, neighbour labels, source text, bounding boxes, or user identifiers in trace data or application logs.

## Goals / Non-Goals

**Goals:**

- Preserve a deterministic, versioned explanation for every resolver outcome (`resolved`, `ambiguous`, `partial`, `unmapped`) at the revision that made it.
- Make the persisted active or historical trace inspectable by the authenticated document owner without invoking the resolver again.
- Record accepted and rejected evidence codes, candidate scores and maturity, missing axes, hard conflicts, outcome rationale, winning candidate when applicable, and catalog/resolver/trace-schema versions.
- Enforce a compact allowlisted schema and redaction at the type, writer, and database boundaries.
- Preserve EH-104/EH-106 idempotency, append-only revision history, service-only RPC access, and active-projection invariants.

**Non-Goals:**

- Change resolver scoring, candidate generation, confidence thresholds, catalog contents, or incomplete-outcome behavior owned by EH-109/EH-112.
- Add a support role, a separate support console, bulk trace search/export, telemetry pipeline, or raw-document audit log.
- Backfill or reconstruct a trace for legacy revisions; an unavailable historical trace must be reported as such rather than recomputed.
- Persist raw labels, values, units, reference ranges, source text, section context, neighbouring labels, document filenames, patient data, or free-form correction reasons in the trace.

## Decisions

### 1. Introduce a first-class, allowlisted trace contract

Create `ResolverDecisionTrace` and a pure `buildResolverDecisionTrace(resolution, options)` adjacent to the resolver types. The trace is canonicalized before persistence and contains only:

- `schemaVersion`, `outcome`, `decisionKind`, and `inputEvidenceHash`;
- catalog manifest version/digest and resolver version;
- nullable `winningCandidateKey` only for a resolved or manual selection;
- candidates in deterministic candidate-key order: definition key, registry maturity, nullable score, accepted/rejected evidence **codes** and strengths, missing axes, and hard-conflict codes;
- de-duplicated missing axes and hard-conflict codes.

`decisionKind` distinguishes the safe, stable explanations: `single_reviewed_candidate`, `multiple_reviewed_candidates`, `recognized_incomplete`, `no_matching_candidate`, and `manual_selection`. Candidate maturity is retrieved from the code registry while building the trace, not trusted from caller input.

The trace must not copy `ResolutionEvidence.observed` or `expected`, even when those fields currently contain only units or specimen. A strict deep validator rejects unknown keys, non-enum values, non-canonical ordering, missing required fields, invalid outcome/identity combinations, and any string field outside the approved identifiers and versions. This is safer than a denylist because resolver evidence will expand over time.

**Alternatives considered:** persisting the existing `candidateEvidence` JSON alone retains an implementation-shaped structure and allows raw `observed`/`expected` values to leak later. Hashing all evidence would be privacy-safe but fails the support-inspection requirement. The allowlisted trace preserves explainability without source content.

### 2. Store the trace only on immutable normalization revisions

Add nullable `resolver_decision_trace jsonb` and `resolver_trace_schema_version text` to `observation_normalization_revisions`, with an additive migration. New atomic-writer calls require a validated trace object and matching schema version; the service RPC verifies its shape with JSONB checks plus a purpose-built validation function before insertion. A write-once trigger rejects changes to either field after non-null population.

The trace is revision-owned; `observations` and `document_extracted_biomarkers` remain projections and must not become a second mutable source of truth. The writer includes the canonical trace in its request hash, ensuring that retry reuse is only possible for the identical decision payload. Existing rows remain nullable and are represented as legacy trace unavailable.

**Alternatives considered:** copying the trace onto the extracted row simplifies a single query but makes historical decisions lossy and creates a mutable duplicate. Making new columns non-null would require unsafe reconstruction or a destructive reset of retained history.

### 3. Preserve the trace in the existing atomic writer transaction

`writeExtractedBiomarkerNormalization` builds the trace from the same resolution and input hash used by `buildResolutionPayload`. It sends `resolver_decision_trace` and `resolver_trace_schema_version` to `write_observation_normalization_revision_v2`; the RPC parses, validates, inserts, promotes, and reuses inside the current transaction. The existing order, locking, CAS, and active-projection primitive remain unchanged.

Manual corrections create a new revision whose trace has `decisionKind: manual_selection`, the selected reviewed winner, and the compatible resolver evidence. No trace is overwritten. The retry path returns the previously persisted trace through the reused revision rather than producing a new row.

**Alternatives considered:** a post-write trace update weakens atomicity and could leave an active decision with no explanation. A separate trace table adds joins and lifecycle complexity without a need for independent trace retention.

### 4. Read persisted traces; label only pre-revision output as preview

The document biomarker route selects trace fields for every revision and `buildNormalizationReview` returns an active/historical persisted trace when present. It must not call `resolveMeasurementDefinition` for a row that has a persisted active revision. For a pre-acceptance row with no revision, it may calculate a `preview` for the current review UI, explicitly marked as not persisted and not historical evidence.

Technical details render the persisted trace outcome, reason, versions, candidate evidence-code summary, missing axes, and conflicts. Legacy revisions render “Decision trace unavailable for this historical revision”; they are never silently replaced by a live calculation. The authenticated document ownership check remains the access boundary.

**Alternatives considered:** recomputing on every GET is simple but violates reproducibility whenever the catalog or resolver changes. An internal-only endpoint would satisfy support but leaves the existing review details misleading and creates an unnecessary parallel contract.

### 5. Treat privacy as an observable contract

The builder and validator accept only normalized machine identifiers, numbers, enum values, and release/version identifiers. No logging statement may serialize `MeasurementResolutionInput`, raw extracted rows, source text, the full trace payload, or database RPC payloads. Failures use stable error codes and request/revision identifiers only where already authorized. Tests use synthetic labels and prove that raw text and raw values cannot appear in a stored or API-returned trace.

## Risks / Trade-offs

- **Trace schema evolution:** readers must dispatch by `schemaVersion` and render unknown future versions as unavailable, not interpret them loosely. This costs a migration/version bump for every incompatible trace format.
- **Legacy revisions lack traces:** support cannot recover historical reasoning without rerunning an old release. This is explicit and safer than pretending a current calculation is historical evidence.
- **Catalog evolution:** candidate key/maturity meaning can change after a release. Persisting manifest digest/version alongside the trace establishes which catalog participated; it does not embed a catalog snapshot.
- **JSONB validation depth:** SQL constraints cannot fully express canonical nested arrays. The trusted application builder and database validator divide responsibility; database fixtures must prove malformed direct RPC payloads are rejected.
- **UI detail size:** every candidate is retained for reproducibility. The client renders compact code summaries and must avoid dumping unbounded JSON or raw source content.