## Context

EH-109 established the resolver's deterministic evidence matrix, score, four outcomes, and persisted decision trace. EH-110 established authoritative alias admission. The current resolver consumes those contracts, but its compatibility evaluator is incomplete: `missingUnitPolicy` is declared but not evaluated, unit is absent from `missingAxes`, absent value kind produces no evidence, missing specimen lacks its declared evidence record, and `allowedSpecimens` duplicates the identity-bearing `specimen` field without affecting resolution.

Conversion lookup currently rejects provisional definitions, but the presentation consumer can request a rule from any reviewed definition key. The safety boundary therefore depends on callers never passing a candidate key from partial or ambiguous evidence. EH-111 must make that invariant explicit at the active normalization read boundary.

This is a documents-domain policy change. It must extend the existing resolver and append-only normalization revision contract rather than introduce a second matcher or reinterpret historical decisions.

## Goals / Non-Goals

**Goals:**

- Define one deterministic compatibility result for unit, value kind, and specimen evidence.
- Preserve the distinction among compatible, missing, and conflicting evidence.
- Prevent missing or unsupported identity axes from producing a concrete measurement identity.
- Make qualitative/ordinal extraction behavior explicit without requiring a numeric unit.
- Establish one specimen source of truth.
- Permit conversion only from an active, resolved, reviewed measurement binding.
- Persist and regress the policy under bumped resolver metadata.

**Non-Goals:**

- Change alias admission, evidence weights, score thresholds, or tie margins established by EH-109 and EH-110.
- Infer unit, value kind, specimen, timing, method, or modifier from labels, neighbouring rows, prevalence, or LLM proposals.
- Add EH-112 incomplete-state UI/API behavior, EH-113 CBC packs, EH-114 glucose packs, EH-115 support traces, or EH-116 reprocessing.
- Rewrite historical normalization revisions or backfill new evidence into old traces.
- Add clinical terminology imports or broaden the launch catalog beyond fixtures needed to prove this policy.

## Decisions

### 1. Evaluate compatibility axes before scoring

Introduce pure policy evaluators for unit, value kind, and specimen. Each evaluator returns one of `compatible`, `missing`, or `conflict`, plus deterministic evidence codes and observed/expected values. Candidate scoring consumes only compatible evidence; missing evidence contributes zero and blocks concrete eligibility when the axis is required; conflict makes the candidate non-selectable.

Eligibility remains separate from ranking. The resolver first evaluates axis policy, then computes the existing evidence score, then admits only complete reviewed candidates to concrete selection. This prevents a high label score or weak context from compensating for incomplete clinical identity.

Alternative rejected: add score penalties for missing or conflicting axes. A sufficiently strong label could then overcome a clinical incompatibility, violating the EH-109 hard-boundary model.

### 2. Make unit policy exhaustive and unit a first-class missing axis

Unit evaluation uses the definition's `missingUnitPolicy` and normalized unit result:

| Policy/input | Result |
| --- | --- |
| `reject` + missing unit | record `unit_missing`, add `unit` to `missingAxes`, and make the candidate non-selectable |
| `ambiguous` + missing unit | record `unit_missing`, add `unit` to `missingAxes`, retain recognition, and normally produce `partial` |
| `display_only` + missing unit | unit is not required; record that no numeric unit is required and do not add a missing axis or unit score |
| numeric policy + accepted normalized token and dimension | compatible, with the existing unit score |
| numeric policy + known incompatible dimension/token | hard conflict |
| numeric policy + unknown non-empty token | explicit unsupported-unit hard conflict, never compatibility |

`reject` and `ambiguous` both prevent concrete resolution when the unit is absent. They differ in policy disposition: `ambiguous` is an expected incomplete state eligible for review, while `reject` is explicitly non-selectable under the definition policy. Both preserve the authorized candidate in the trace rather than turning a known label into `unmapped`.

A display-only definition does not gain unit evidence or conversion eligibility from an incidental input unit. Registry validation requires numeric definitions to declare a non-display unit policy and qualitative/ordinal definitions that do not require units to use `display_only`.

Alternative rejected: treat an unknown token as missing. The extractor observed a unit claim; degrading it to absence would hide an incompatibility and could enable unsafe conversion.

### 3. Treat qualitative and ordinal as compatible non-numeric representations

A numeric definition accepts only observed `numeric`. Missing value kind is `value_kind_missing`, adds `value_kind` to `missingAxes`, and prevents concrete resolution. Observed `qualitative` or `ordinal` against numeric is a hard conflict.

Qualitative and ordinal definitions accept either observed `qualitative` or `ordinal`. This is a representation compatibility rule, not identity inference: parsers commonly encode ordered strings such as `Negative`, `Trace`, or `Positive` as ordinal, while registry definitions describe the clinical scale as qualitative. Missing value kind remains missing whenever the definition declares a non-`unspecified` value kind. Definitions with `unspecified` value kind impose no requirement and receive no value-kind score.

Alternative rejected: change `parseLabValueCell("Negative")` to emit qualitative. That would move a registry compatibility decision into a generic parser and could break consumers that depend on ordered categories.

### 4. Use `specimen` as the sole definition policy

Remove `allowedSpecimens` from `MeasurementDefinition`, catalog records, release serialization, and change classification. The identity-bearing `specimen` field is the authoritative compatibility requirement. A definition with `specimen = unspecified` imposes no specimen requirement. Otherwise, missing input produces `specimen_missing` plus the `specimen` missing axis; a supported but different specimen produces `specimen_conflict`; an unknown non-empty specimen token produces an explicit unsupported-specimen conflict.

The current reviewed records duplicate their canonical specimen in one-element `allowedSpecimens` arrays, so this is a clean removal rather than a semantic catalog migration. A future definition that genuinely supports multiple specimens must be represented as distinct identity definitions or introduced through a separately reviewed policy change.

Alternative rejected: make `allowedSpecimens` authoritative while retaining `specimen` for identity. Two independently editable fields would continue to permit contradictory release manifests and ambiguous conversion identity.

### 5. Gate conversion on a resolved active binding, not a bare candidate key

Keep conversion metadata attached only to reviewed definitions, but make consumers obtain it through a resolved-binding guard. The guard accepts the active normalization revision/read DTO and returns a binding only when all of these are true:

1. the revision is active;
2. its resolver outcome is `resolved`;
3. its concrete `measurement_definition_key` is non-null and equals the selected key in the persisted decision trace;
4. the definition is reviewed with Registry 2.0 review provenance; and
5. the definition has a reviewed conversion policy.

Partial, ambiguous, unmapped, provisional, conflicted, inactive, and evidence-only candidate keys return no binding and therefore no conversion. Presentation code consumes the guarded binding rather than calling conversion lookup with an arbitrary key. The read boundary remains responsible for exposing a concrete key only for `resolved` rows, and regression coverage proves both sides of that contract.

Alternative rejected: rely only on `getMeasurementConversionPolicy(key)`. A reviewed candidate key found inside incomplete decision evidence is not an active identity, so key maturity alone is insufficient authority.

### 6. Preserve four outcomes while tightening concrete eligibility

The resolver keeps `resolved`, `ambiguous`, `partial`, and `unmapped`. Unit joins specimen, value kind, modifier, timing, and method as a structured missing axis. A recognized candidate with any required missing axis is ineligible for concrete resolution and produces `partial` unless another complete candidate determines `resolved` or multiple complete candidates determine `ambiguous`. Hard-conflicted candidates remain traceable but non-selectable. Only `resolved` exposes a concrete measurement definition key.

Alternative rejected: introduce a fifth outcome for every policy disposition. EH-112 depends on the stable four-state contract; detailed evidence codes and missing axes already preserve the reason.

### 7. Version and verify the policy as one cutover

Bump resolver and normalization policy metadata for new decisions. The decision trace records per-axis disposition, missing axes, conflicts, eligibility, outcome, selected key, and version. Existing append-only revisions retain their prior versions and interpretation.

Coverage is table-driven at the pure policy layer and end-to-end across extraction input, resolver output, persisted active revision, read DTO, and conversion presentation. The regression matrix includes percent versus absolute count in both directions; serum, plasma, whole-blood, and urine conflicts; missing specimen; missing, unknown, accepted, and wrong-family units; numeric/qualitative/ordinal value kinds; and conversion denial for every incomplete state.

Alternative rejected: test only the resolver function. The highest-risk regression is a downstream consumer treating evidence-only identity as active identity.

## Risks / Trade-offs

- **[More recognized rows become partial after unit and value-kind enforcement]** → Preserve raw inputs and structured missing evidence; treat this as safer review work rather than restoring inference.
- **[Qualitative/ordinal compatibility is broader than exact equality]** → Limit the equivalence to those two non-numeric representations and retain the observed representation in evidence.
- **[Removing `allowedSpecimens` changes manifest digests]** → Bump catalog/resolver metadata together and verify every current array equals the canonical `specimen` before removal.
- **[Unknown unit or specimen tokens may increase conflicts]** → Preserve the raw and normalized token with an explicit unsupported code so catalog curation can distinguish unsupported from missing.
- **[Conversion guards can be bypassed by future callers]** → Export one resolved-binding conversion entry point, migrate all consumers in the same change, and add a static/reference regression for direct bare-key use.
- **[Historical traces use the older evidence shape]** → Version the new trace/policy and never reinterpret or rewrite stored revisions.

## Migration Plan

1. Add the pure compatibility result types, evidence codes, `unit` missing axis, and registry invariants under bumped resolver metadata.
2. Remove `allowedSpecimens` after validating that every current value duplicates `specimen`; update release serialization and compatibility classification.
3. Integrate unit, value-kind, and specimen evaluators into the existing candidate evidence path and concrete eligibility filter.
4. Propagate the tightened decision trace through extraction, append-only normalization publication, and active read DTOs.
5. Add the resolved-binding guard and migrate conversion consumers away from bare candidate keys.
6. Run policy, resolver, launch-corpus, persistence/read-boundary, and conversion-denial regressions; record EH-111 manual QA and developer evidence.
7. Roll back application code as one release if required. Do not mutate revisions already written with the new version; their stored policy metadata preserves interpretation.

## Open Questions

No implementation-blocking questions remain. Clinical review of any newly encountered unit or specimen token is catalog curation and must not be replaced by runtime inference.
