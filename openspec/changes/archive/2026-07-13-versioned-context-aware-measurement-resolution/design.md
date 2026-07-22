## Context

EasyHealth has a static TypeScript biomarker catalog and an extraction-review-acceptance pipeline. Extraction rows already retain raw names, values, units, document provenance, extraction confidence, specimen, and modifier. Accepted rows are currently upserted into `observations` using a canonical key resolved primarily from an alias. This makes the current key both the storage identity and the semantic classification of a laboratory measurement.

That model is insufficient for measurements that share a label but differ by unit, specimen, modifier, or analytical form. Examples include absolute versus percentage differentials, RDW-CV versus RDW-SD, and glucose measured in blood versus urine. The existing health-profile engine is intentionally based on stable canonical keys and MUST remain compatible during this change.

## Goals / Non-Goals

**Goals:**

- Add code-based, versioned `MeasurementDefinition` metadata for concrete laboratory measurements.
- Resolve a raw extracted line deterministically from contextual evidence instead of an alias alone.
- Preserve raw evidence and every normalization decision so reprocessing is auditable and reversible.
- Keep current `biomarker_key` values, unit presentation, observation identity, and assessment contracts compatible during rollout.
- Prevent ambiguous, unmapped, inactive, or assessment-incompatible candidates from entering charts or the assessment engine.
- Provide a controlled review path for user verification and manual mapping correction.

**Non-Goals:**

- Move the registry into SQL or introduce a general terminology service.
- Add Panel Registry, LOINC mappings, Knowledge Base content, external ranges, diagnoses, or medical recommendations.
- Change `scoreRequiredGroups`, score weights, document-native reference behavior, or create a new assessment model.
- Retroactively rewrite historical observations in place.

## Decisions

### 1. Add measurement definitions beside canonical biomarker definitions

The static catalog gains `MeasurementDefinition` records. A definition describes one measurable laboratory form and includes a stable key, display metadata, accepted canonical unit tokens, optional specimen/modifier constraints, aliases, an engine-facing compatibility key, and assessment compatibility.

Examples:

```ts
{
  key: "neutrophils_abs",
  canonicalKey: "neutrophils",
  requiredUnitDimension: "cell_concentration",
  allowedSpecimens: ["whole_blood"],
  modifier: "absolute",
  assessmentCompatibility: "display_only",
}
```

`biomarker_key` remains the legacy-compatible identity used by existing consumers. `measurement_definition_key` is additive and describes the precise resolved measurement. A measurement definition can map to a legacy key only when the mapping is explicit and safe. A new measurement that cannot safely share an existing key receives its own storage key and is excluded from assessment until explicitly supported.

Alternative rejected: replace every canonical biomarker key with a new measurement key. This would break current trends, write identity, scoring registries, and API consumers without improving the first rollout.

### 2. Separate raw extraction, resolver outcome, and human verification

The pipeline stores three independent concepts:

```text
Raw extraction:          raw label, raw value/text, raw unit, source evidence
Resolver outcome:        resolved | ambiguous | unmapped
Verification decision:   pending | user_verified | manually_corrected
```

Extraction confidence and mapping confidence are separate fields. Extraction confidence measures whether text/value/unit was read correctly; resolver confidence measures whether the available evidence identifies one measurement definition.

Alternative rejected: encode human verification in the resolver status. It would make it impossible to distinguish an unambiguous rule result from a user override.

### 3. Use hard constraints before ranked evidence

Resolution uses this precedence:

1. Existing manual correction for the same extracted row.
2. Exact definition key or authoritative structured extraction code when it passes constraints.
3. Explicit specimen and modifier from the source.
4. Unit dimension and normalized unit-token compatibility.
5. Exact normalized alias match.
6. Document section context and compatible neighbouring observations, when present.
7. Reference-range shape only as a weak tiebreaker.

The resolver first normalizes a unit token without converting the numeric value. Numeric conversion happens only after a definition is selected. A candidate is rejected when an explicit unit, specimen, or modifier conflicts with that definition. Neighbouring observations can break a tie but cannot override a hard conflict.

If no candidate remains, the result is `unmapped`. If more than one compatible candidate remains without a deterministic winner, the result is `ambiguous`. The resolver MUST not guess.

For fasting glucose, only an explicit fasting label or source modifier can resolve `fasting_glucose`; an ordinary glucose line remains a non-fasting measurement even if no conflicting context is present.

### 4. Make normalization decisions append-only

Raw extracted biomarker rows remain immutable evidence. The database adds an append-only `observation_normalization_revisions` store linked to an extracted row and, after promotion, optionally to its active observation. Each revision records:

- input evidence snapshot/hash;
- `measurement_definition_key` and legacy-compatible `biomarker_key` when resolved;
- resolver result and mapping confidence;
- registry version, resolver version, and normalization schema version;
- verification status and actor/source of a manual correction;
- creation time and promotion/supersession links.

An active `observations` row is a materialized, compatibility-preserving projection of a promoted revision. Reprocessing creates a new candidate revision; it never mutates a historical revision. Promotion of a candidate that changes the effective observation identity or assessment eligibility requires explicit review. Compatibility-preserving auto-promotion is permitted only behind the feature flag and only for unambiguous high-confidence mappings.

Alternative rejected: add version fields directly to `observations` and overwrite them on every reprocess. This loses the old decision and makes score/history changes unauditable.

### 5. Define compatibility and assessment gates explicitly

The resolver outputs an `assessment_compatible` decision from the definition compatibility policy, not from the raw alias. Health-profile and score aggregation read only active observations whose promoted revision is `resolved`, assessment-compatible, and not superseded. Existing legacy observations without a revision remain available through a compatibility fallback until individually reprocessed; they retain current behavior during the rollout.

This preserves the strict readiness design: an ambiguous glucose line cannot unlock `fasting_glucose`, and a urine glucose line cannot become a metabolic blood glucose contribution.

### 6. Roll out in shadow mode before changing active data

The resolver is feature-flagged. In shadow mode it creates no active observations and no score changes; it records comparison outcomes against the legacy alias resolver for selected extraction rows. Metrics capture resolved/ambiguous/unmapped rates, conflicts, definition distribution, and mapping differences. Promotion is enabled only after fixture coverage and sampled review show acceptable behavior.

## Minimal Type and Data Changes

```ts
type ResolverResult = "resolved" | "ambiguous" | "unmapped";
type VerificationStatus = "pending" | "user_verified" | "manually_corrected";

type MeasurementDefinition = {
  key: string;
  canonicalKey: string | null;
  aliases: string[];
  allowedUnitTokens?: string[];
  allowedSpecimens?: string[];
  requiredModifier?: string;
  assessmentCompatibility: "compatible" | "display_only" | "incompatible";
};
```

Extracted rows gain resolver metadata for the latest candidate. `observations` gain nullable `measurement_definition_key` and a link to the promoted normalization revision. The revision table stores all versioned decisions. Existing raw/provenance columns are reused rather than duplicated.

## Reprocessing Policy

1. Select extracted rows or legacy observations with recoverable provenance.
2. Run the current registry/resolver in shadow or candidate mode.
3. Store a new revision with all input and version metadata.
4. Compare candidate versus active identity and assessment compatibility.
5. Auto-promote only feature-flagged, compatibility-preserving, deterministic candidates.
6. Route identity/eligibility changes, ambiguous rows, and missing-unit rows to review.
7. Recompute affected deterministic views only after promotion; never silently rewrite a score history.

## Test Plan

- Unit-test candidate selection, hard rejection, deterministic precedence, and resolver-version persistence.
- Add fixtures for absolute/percentage neutrophils and lymphocytes, RDW-CV/RDW-SD, absolute/percentage reticulocytes, blood versus urine glucose, fasting ambiguity, segmented/band neutrophils, incompatible units, missing units, and high/low OCR confidence.
- Test append-only revision creation, supersession, explicit promotion, rollback to a previous active revision, and no-write shadow mode.
- Test that ambiguous/unmapped/inactive candidates do not enter trends, confidence, system readiness, or score inputs.
- Run regression tests for existing alias resolution, observation identity, unit conversion, extraction acceptance, biomarker overview, and health-profile aggregation.

## Risks / Trade-offs

- [Context extraction is incomplete for many legacy PDFs] -> Treat missing evidence as ambiguous or preserve the legacy active observation; do not infer a more specific definition.
- [The review UI can become complex] -> Start with a narrow definition picker and evidence display for ambiguous rows only.
- [A revision store increases operational data] -> Store compact metadata and retain raw evidence in the existing extraction record; index by extracted row and active state.
- [Compatibility mappings can accidentally alter scores] -> Gate promotion by compatibility policy, feature flag, and deterministic aggregation regression tests.
- [Static registry version changes are hard to identify] -> Publish a monotonic registry version plus a deterministic manifest digest in every revision.

## Migration Plan

1. Ship additive schema columns and the append-only revision table with no read-path behavior change.
2. Add the measurement-definition registry and resolver behind a disabled feature flag.
3. Enable shadow mode for new extractions and sampled reprocessing; collect comparison metrics.
4. Add review confirmation/manual correction and candidate promotion.
5. Enable compatibility-preserving auto-promotion for explicitly approved definitions.
6. Reprocess selected historical rows in batches; leave unresolved legacy rows on their existing compatibility path.
7. Roll back by disabling promotion/read-path flag. Raw evidence and revisions remain intact; active observations stay unchanged.

## Open Questions

- The initial set of measurement definitions needs clinical/product curation for the exact allowed unit-token matrix, especially RDW variants and differential labels.
- The actor model for `manually_corrected` must state whether only the account owner can correct a mapping in v1 or whether an internal reviewer role will exist.
