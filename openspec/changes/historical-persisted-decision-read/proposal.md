## Why

A persisted normalization decision is still partly explained by current runtime state: `buildNormalizationReview` invokes the live Resolver even when an active revision exists, while consumer projections read different shapes from `resolver_evidence` and `resolver_decision_trace`. A catalog or Resolver change can therefore make a historical decision appear current, and missing legacy trace data can be silently replaced by a recomputed explanation.

This change introduces one persisted-decision read contract that consumes the identity/version data from `prepare-resolver-evidence-identity` and keeps current Resolver evaluation only at explicit preview or new-evaluation seams.

## What Changes

- Add a shared persisted-decision reader for active and historical normalization revisions. It SHALL treat the selected persisted revision and its stored decision evidence as authoritative and SHALL not invoke the current Resolver for a persisted decision.
- Separate read **source** from read **quality**:
  - source: `persisted`, `preview`, or `none`;
  - quality: `available`, `unavailable`, or `conflict`.
- Preserve `conflict` as a first-class quality state when persisted outcome, selected identity, `resolver_evidence`, `resolver_decision_trace`, trace schema, or related version fields disagree. Conflict SHALL not be downgraded to unavailable or repaired by current Resolver output.
- Use `unavailable` for missing legacy trace, unsupported persisted metadata, or unavailable catalog enrichment. A legacy or incomplete historical record SHALL remain visibly unavailable rather than receiving a live explanation.
- Permit `preview` only when no active persisted revision exists and the caller explicitly requests a current preview. Preview results SHALL be marked non-persisted and SHALL not grant downstream definition-specific eligibility.
- Centralize active-revision selection, persisted trace parsing, projection, consistency checks, and availability metadata for normalization review, incomplete-outcome serialization, document biomarker details, Health Profile linked observations, reports, and structured context.
- Keep current Registry lookups as optional historical enrichment only. A missing, retired, or changed current definition SHALL not alter the stored outcome or trace; the reader SHALL expose the appropriate quality state and fail closed where concrete consumer binding is unavailable.
- Keep legacy `resolver_evidence` readable for existing operational projections, but do not silently treat it as a complete technical trace when `resolver_decision_trace` is absent or invalid.
- Preserve the existing atomic writer/reversal and Resolver input identity contracts from `prepare-resolver-evidence-identity`; this change only reads their persisted results.
- Preserve the EH-164 invariant: comparator/detection-limit markers may remain accepted text Health Profile inputs with `value: null`, but never contribute to numeric score or trend calculations.

## Capabilities

### New Capabilities

- `persisted-decision-read`: Source/quality-aware reading of persisted Resolver decisions, previews, conflicts, and unavailable historical evidence.

### Modified Capabilities

- `resolver-decision-trace`: Active and historical trace reads use persisted data without Resolver recomputation and expose independent source and quality states, including `conflict`.
- `incomplete-laboratory-outcomes`: Outcome serialization consumes the shared persisted-decision reader and preserves authoritative stored outcomes when current catalog or trace data is unavailable.
- `document-extraction-review`: Review projections and technical details distinguish persisted, preview, unavailable, and conflicting decision data without presenting current Resolver output as historical rationale.

## Impact

- Depends on `openspec/changes/prepare-resolver-evidence-identity/` for persisted input identity/version fields and explicit restore/reprocessing contracts.
- Affected code: `observation-read-boundaries`, normalization review and outcome projection modules, document biomarker/read APIs, Health Profile linked-observation projection, reports, structured context, and shared trace parsers.
- Affected API/UI contracts: revision technical details gain separate source and quality metadata; persisted outcomes, raw evidence, scoring, trend behavior, and preview eligibility remain unchanged except for truthful unavailable/conflict reporting.
- Affected consistency rules: active revision fields, selected candidate identity, operational evidence, technical trace, trace schema, identity version, and release metadata are checked without mutating historical rows.
- No new live Resolver evaluation is introduced for persisted observations. Explicit correction, acceptance, reprocessing, and no-revision preview paths retain their separate prospective behavior.
- EH-164 regression evidence remains mandatory for this change; no Health Profile admission or numeric scoring requirement is redesigned.
