## Context

EH-102 defines a safe four-state resolution model: only one justified reviewed concrete definition may be `resolved`; recognized but incomplete or provisional candidates are `partial`; competing reviewed candidates are `ambiguous`; and no recognized catalog identity is `unmapped`. EH-104 and EH-105 already persist active append-only normalization revisions and atomically project their result to observations.

The current resolver has the outcome names and a candidate-evidence DTO, but direct normalized-string matching bypasses alias governance, only label/unit/specimen/modifier/value kind are considered, and `score` is a count of accepted items. It treats a value-kind mismatch as missing, does not inspect timing, method, section, neighbouring rows, or reference shape, and assigns confidence from outcome constants. EH-110 provides the required alias-admission authority; this change consumes it without restating its policy.

## Goals / Non-Goals

**Goals:**

- Evaluate every admitted candidate with a typed, versioned evidence matrix.
- Make contradiction, absence, and support separate states, with hard conflicts eliminating concrete eligibility.
- Select a reviewed concrete definition only through deterministic score, threshold, and margin rules; never let ordering choose a tied winner.
- Preserve the existing four outcomes with an explicit reviewed/provisional and incomplete-state matrix.
- Persist the reproducible decision basis, policy version, and evidence DTO through the existing atomic normalization writer and active revision boundary.

**Non-Goals:**

- Redefine EH-110 alias lifecycle, source scope, or fuzzy matching policy.
- Supply EH-111's detailed unit, value, specimen, or clinical compatibility corpus; this change provides its policy hooks and baseline safe behavior.
- Build incomplete-state UI, trends, scoring exclusion, batch reprocessing, or decision-trace product features owned by EH-112, EH-115, and EH-116.
- Infer a missing identity axis from label popularity, document prevalence, a model-proposed key, or another candidate's score.
- Automatically verify a mapping or change the EH-104 verification-status matrix.

## Decisions

### 1. Consume EH-110 admissions as the only label evidence

The resolver receives candidate admissions from EH-110's alias boundary. An admission carries alias key, declared policy, authority, approval, scope/provenance, and its label-match evidence. It is the only way a raw label can enter candidate evaluation. `proposedKey` remains diagnostic extraction metadata and cannot create or promote a candidate. A reviewed active definition with an active reviewed-resolution admission is the only kind of candidate eligible for concrete selection; active provisional or recognition-only admissions remain in the evidence set and can produce `partial` recognition.

Alternative rejected: retain a proposed-key or normalized-label fast path. It would recreate alias authority outside the catalog and make corpus-derived strings able to bypass review.

### 2. Evaluate a fixed evidence matrix with explicit support, absence, and conflict semantics

Each candidate receives one `ResolutionEvidence` entry per applicable axis. Support adds the declared weight; absence records the missing axis without weight; a hard conflict records the actual and expected values and makes the candidate ineligible. The initial policy is versioned as `evidence-1` and uses this fixed maximum-100 score:

| Axis | Support weight | Hard conflict | Missing behavior |
| --- | ---: | --- | --- |
| Reviewed alias admission | exact 40; normalized 36; OCR 32; bounded fuzzy 28 | none after EH-110 admission | no admission means no candidate |
| Unit | 20 | incompatible dimension or unaccepted unit; missing where policy is `reject` | record `unit` when policy is `ambiguous` |
| Specimen | 15 | stated specimen differs from concrete definition | record `specimen` when definition is concrete and source omits it |
| Value kind | 10 | stated kind differs from concrete definition | record `value_kind` when definition is concrete and source omits it |
| Timing | 5 | stated timing differs from concrete definition | record `timing` when definition is concrete and source omits it |
| Method | 4 | stated method differs from concrete definition | record `method` when definition is concrete and source omits it |
| Required modifier | 2 | stated modifier does not satisfy the definition | record `modifier` when the definition requires it and source omits it |
| Section/panel | 2 | none in `evidence-1` | no score when absent or unrelated |
| Neighbouring rows | 1 | none in `evidence-1` | no score when absent or unrelated |
| Reference shape | 1 | none in `evidence-1` | no score when absent or unsupported |

The resolver adds `timing`, `method`, `laboratory`, and structured reference-shape inputs where source extraction can supply them; it does not derive values from a default definition. Section, neighbour, and reference shape are corroborative only in `evidence-1`: they can support but never create a candidate, erase a hard conflict, or resolve a tie by themselves. EH-111 may extend the compatibility tables and field parsing but cannot weaken these conflict semantics without a new evidence-policy version.

Alternative rejected: count accepted facts. Counts make weak and strong facts equivalent, make outcome confidence non-reproducible, and cannot explain why a conflict lost to enough unrelated supports.

### 3. Gate outcome selection with score, completeness, and margin

A candidate is `concreteEligible` only when it is a reviewed active definition with reviewed-resolution alias authority, has no hard conflict, has no required missing identity axis, and has an evidence score of at least 70. The resolver orders candidates by descending score then ascending definition key for reproducible DTO output; definition-key order is never a clinical tie-breaker.

When exactly one candidate is concrete-eligible, or the leading candidate exceeds every other concrete-eligible candidate by at least eight points, it is selected as `resolved`. When two or more concrete-eligible candidates have a leading margin below eight, the result is `ambiguous` and no definition is selected, even if stable sort places one first. When one or more aliases admit recognition but no concrete candidate qualifies, the result is `partial`. Only an input with no active alias admission is `unmapped`.

The full outcome matrix is:

| Admissions and evaluation | Result | Selected definition | Verification implication |
| --- | --- | --- | --- |
| No active alias admission | unmapped | null | pending only |
| Only provisional/recognition-only admission, or reviewed admission with missing required identity evidence | partial | null | pending only |
| Reviewed candidate has any hard conflict | partial if another recognition remains; otherwise unmapped | null | pending only |
| One reviewed concrete-eligible candidate | resolved | that key | eligible for existing resolved verification flow |
| Multiple reviewed concrete-eligible candidates within eight points | ambiguous | null | pending only |
| Leading reviewed candidate wins by at least eight points | resolved | that key | eligible for existing resolved verification flow |

An `unmapped` result does not preserve a rejected direct-string match; `partial` preserves all admitted recognition and conflict evidence. This retains raw evidence without fabricating a concrete identity.

Alternative rejected: select the lexical first candidate on equal score. That produces deterministic but clinically arbitrary false resolution and hides a genuine ambiguity.

### 4. Derive confidence from policy evidence rather than the final enum

Every candidate records `score` and `candidateConfidence = score / 100`, rounded to two decimals. `MeasurementResolution.mappingConfidence` is the selected candidate's confidence; it is `0` when no candidate is selected. Bands are numeric: high at 0.80 or greater, medium from 0.50 through 0.79, and low below 0.50. The selected mapping's score, threshold, and winner margin are included in the decision payload so an `ambiguous` output can show high individual candidate support without claiming a selected mapping.

Manual correction continues to require a reviewed candidate with no hard conflict and appends audit evidence, but it MUST NOT replace computed confidence with a constant. The existing verification writer remains the owner of manual/user verification state.

Alternative rejected: assign confidence by `resolved`, `partial`, or `ambiguous`. That conflates semantic state with evidence quality and makes a barely qualified result indistinguishable from one supported by every axis.

### 5. Persist a versioned decision envelope through active revisions

Extend `resolver_evidence` from a bare candidate array to a typed, JSON-serializable decision envelope containing evidence-policy version, ordered candidate evidence, selected key, selected score/confidence, threshold, winner margin, missing axes, conflicts, and alias-admission provenance. Add `evidence_policy_version` to extracted-biomarker and normalization-revision records; new resolver writes MUST set it to `evidence-1`. The input-evidence and writer-request hashes include timing, method, laboratory, reference shape, value kind, and policy version so retries are idempotent only for identical decisions.

The atomic writer remains the sole persistence path. It stores the envelope and policy version before the existing compare-and-swap promotion; active observation projections remain only `measurement_definition_key` and `resolution_status`. Historic revisions are not rewritten: their null/legacy policy version denotes pre-EH-109 evidence and is never treated as equivalent to `evidence-1`.

Document normalization review and document-detail DTOs expose the envelope and policy version from the active revision, with candidate scores and alias keys available for audit. EH-112 owns user-facing wording and consumer exclusion behavior.

Alternative rejected: persist only final status and confidence. That makes an evidence-policy change unreproducible and prevents safe reprocessing/trace work in EH-115 and EH-116.

## Risks / Trade-offs

- **[Existing extraction lacks timing or method]** -> Record those axes as missing; do not invent them. Reviewed concrete resolution becomes partial until source evidence is supplied or a later reviewed policy changes the definition.
- **[Initial weights need calibration]** -> Keep them centralized and versioned, use deterministic fixtures, and introduce a new policy version for changes rather than altering historical interpretation.
- **[Context evidence may be noisy]** -> Restrict it to low-weight corroboration in `evidence-1`; it cannot overcome a hard clinical conflict or decide a close race alone.
- **[JSON envelope evolution breaks readers]** -> Validate a discriminated envelope at writer/read boundaries and retain legacy revision interpretation as an explicit legacy shape.
- **[Persistence migration encounters retained environments]** -> Add columns without rewriting revisions, deploy writer/readers together, and use EH-104's existing active-revision invariants for atomic projection.

## Migration Plan

1. Complete EH-110 and expose its alias-admission API and records; prohibit implementation of this change against direct alias strings.
2. Add the versioned evidence types, structured resolution input axes, centralized `evidence-1` policy, and pure candidate evaluator with deterministic ordering.
3. Update the resolver, normalization policy, and manual-correction path to use eligibility, conflicts, scores, margins, and calculated confidence.
4. Add the additive persistence columns and typed decision envelope; update the atomic writer, hashes, normalization review, and document DTOs without mutating historical revisions.
5. Add resolver, writer, API/DTO, and regression fixtures for every outcome-matrix row, ties, context support, hard conflicts, and policy-version persistence.
6. Update `QA/eh-109/checklist.md`; run focused biomarker, writer/database, and CBC regression commands before release.

## Open Questions

- No implementation-blocking question remains. The `evidence-1` numerical policy is deliberately explicit; calibration changes require a new policy version and fixtures, not runtime tuning.