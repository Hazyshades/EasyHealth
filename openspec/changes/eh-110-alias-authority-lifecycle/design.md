## Context

EH-102 made Registry 2.0 the laboratory identity model and required structured aliases with source, match type, status, and fixture references. EH-106 made Registry 2.0 the runtime boundary. The current runtime partially models these fields in `MeasurementAlias`, but the catalog helper creates every entry as a reviewed normalized alias; `resolveMeasurementDefinition` compares only `normalizedValue`; and release manifests omit approval and fixture attribution. The result cannot distinguish curated authority from corpus evidence or safely support the evidence policy planned for EH-109.

EH-110 is documents-domain registry governance. It freezes the alias contract consumed by EH-109; it does not redesign evidence scoring, incomplete-state persistence, or clinical unit/specimen compatibility.

## Goals / Non-Goals

**Goals:**

- Make every resolver-admitted alias an explicit, provenance-bearing Registry 2.0 record.
- Separate alias review authority, lifecycle, source scope, and match policy from display strings and measurement-definition maturity.
- Permit only bounded, deterministic matching policies and expose the actual matched alias to the resolver evidence layer.
- Preserve de-identified launch-corpus ownership and negative-authority evidence in the release manifest and regression suite.
- Cut over all Registry 2.0 catalog creation and resolver admission to this single contract with no legacy alias fallback.

**Non-Goals:**

- Define EH-109 evidence weights, confidence calibration, winner selection, or full candidate tie policy.
- Add clinical terminology imports, diagnose conditions, or infer missing specimen, timing, method, or value kind.
- Promote a provisional definition to a reviewed concrete identity merely because one of its aliases is reviewed.
- Change historical observation revisions, reprocess documents, or build manual alias-management UI.
- Support open-ended fuzzy, substring, token-containment, phonetic, or machine-learned string matching.

## Decisions

### 1. Model aliases as explicit immutable authority records

Replace the current free-form alias shape with an `AliasDefinition` owned by one `MeasurementDefinition`. Each record has a stable `key`; literal `value`; deterministic `normalizedValue`; `source` (`canonical`, `registry`, `laboratory`, or `fixture`); `matchType`; `approvalStatus`; `lifecycle`; optional locale and laboratory scope; provenance containing a source record key and required corpus fixture references when `source = fixture`; and a review reference for reviewed authority.

`matchAuthority` is explicit: `recognition_only` or `reviewed_resolution`. An active reviewed alias with `reviewed_resolution` authority is eligible to support a reviewed definition candidate. Every other active alias can establish recognition only. A deprecated alias is retained in manifests and release history but is ineligible for new matching. A reviewed alias attached to a provisional or retired definition still cannot create a concrete resolution.

Alternative rejected: derive authority from definition maturity or alias source. One definition can legitimately carry both reviewed laboratory aliases and provisional corpus evidence, and source labels alone cannot express lifecycle or review ownership.

### 2. Constrain matching by declared policy and source scope

Alias matching returns a `MatchedAlias` only when the alias is active and its policy matches the extraction label. `exact` compares a canonical Unicode/trimmed literal; `normalized` compares the catalog normalization token; `ocr_variant` compares an explicitly declared OCR form; and `bounded_fuzzy` compares normalized tokens with a per-alias maximum Damerau-Levenshtein distance of one or two, a minimum normalized length of five, and an explicit reviewed-resolution authority record. No other distance, substring, token-containment, phonetic, or proposed-key-only matching is allowed.

A laboratory-scoped alias applies only when the input laboratory identity equals its scope. An unscoped alias is global. Locale remains attribution and does not select a match until a future locale-aware extraction input is introduced. `fixture` aliases require a declared fixture reference and cannot gain reviewed-resolution authority merely because their text equals an active reviewed alias.

Alternative rejected: normalize all input and compare all aliases. That remains deterministic but silently turns corpus/OCR strings into universal clinical identity claims and gives no way to constrain fuzzy matches.

### 3. Make alias authority a first-class resolver boundary

The resolver obtains candidate admissions from an alias-index function rather than inspecting `definition.aliases` directly. Each admission includes definition key, alias key, match type, authority, provenance, and matching evidence. Candidate evidence stores the matched alias key and emits an alias-specific reason code; EH-109 will use that record, not re-evaluate raw strings, for weights and reviewed/provisional policy.

EH-110 limits the post-admission result to authority eligibility: candidate collection may include recognition-only aliases, but only reviewed-resolution admissions for reviewed active definitions can enter the concrete-resolution set. EH-109 owns any further evidence acceptance, scoring, and tie-breaking.

Alternative rejected: let EH-109 encode alias filtering inside its scorer. That duplicates medical-governance policy in a resolver algorithm and makes manifest/release evidence unable to state what was actually authorized.

### 4. Treat the launch corpus as owned evidence, not catalog truth

Create a versioned corpus descriptor whose fixture IDs are stable and whose entries identify de-identified document source, laboratory attribution when known, exact label, and authorized alias keys. Fixture-sourced aliases must cite this descriptor. Each reviewed or bounded-fuzzy authority record names a review reference; each negative case names the disallowed alias and expected non-admission outcome.

The release suite includes at minimum: deprecated alias, provisional alias, alias for another laboratory, unapproved fuzzy alias, over-distance fuzzy input, and fixture-only alias against a reviewed definition. These cases prove non-authority, not merely non-equality.

Alternative rejected: retain fixture references as optional metadata. Optional strings cannot show that a corpus label was reviewed, nor can they prevent a fixture alias from becoming a global match.

### 5. Serialize and classify the complete authority contract

The deterministic manifest serializes every alias field that affects matching or release interpretation: stable key, literal and normalized values, source, match type and bounds, authority, approval status, lifecycle, locale, laboratory scope, source/review references, and fixture references. Stable serialization continues to sort object keys and array values deterministically.

Changing an alias's admitted text, source scope, match policy, authority, approval, lifecycle, provenance, or fixture ownership is at least `review_required`; a change that removes an active reviewed-resolution admission or broadens authority/match scope is `breaking`. Display-only definition changes remain compatibility-preserving. The catalog and resolver versions are bumped together because authority affects mapping behavior.

Alternative rejected: serialize only fields useful for display. A digest that excludes admission policy cannot reproduce or audit resolver behavior.

### 6. Perform a pre-launch clean cutover

Migrate every in-code alias into an explicit `AliasDefinition`, assigning reviewed authority only where launch review evidence exists. Replace the generic alias factory and direct normalized-string comparisons. Remove compatibility fields, implicit defaults, aliases without source records, and any fallback matching path in the same change. Existing observations retain their revision-stored resolver evidence; registry release history remains reproducible through manifests rather than runtime support for deprecated aliases.

Alternative rejected: retain the old `MeasurementAlias` path while incrementally converting records. Dual admission paths would make an alias's authority unknowable and immediately undermine EH-109.

## Risks / Trade-offs

- **[Initial corpus attribution is incomplete]** -> Keep it provisional and recognition-only; do not promote it based on matching frequency.
- **[Bounded fuzzy matching collides with another analyte]** -> Enforce the small per-alias bound and let EH-109 surface multiple admitted reviewed candidates as ambiguous rather than choose one.
- **[Explicit metadata increases catalog verbosity]** -> The additional source data is the required audit trail for clinical identity and generates deterministic release evidence.
- **[Cutover changes current coverage results]** -> Run the launch corpus plus negative-authority suite; preserve raw accepted observations and schedule missing authority as curation work rather than restore permissive matching.
- **[Manifest consumers assume aliases are unordered display strings]** -> Version the manifest and update all consumers with the semantic alias record in one pre-launch cutover.

## Migration Plan

1. Introduce the AliasDefinition, match-authority, lifecycle, provenance, bounded-fuzzy, and matched-admission types with runtime validation for catalog invariants.
2. Create the versioned de-identified launch-corpus descriptor and migrate every reviewed and fixture alias to explicit records with stable keys and source/review references.
3. Replace catalog helper construction and direct alias comparison with the alias-admission index; update candidate evidence and resolver versioning without adding EH-109 scoring rules.
4. Extend registry-manifest serialization, digest tests, and change classification to cover the full authority contract.
5. Add positive corpus and negative-authority regressions, then remove the old alias shape, implicit review defaults, and permissive match path in the same release.
6. Record the EH-110 tester/developer evidence in `QA/eh-110/checklist.md`; launch only after the catalog, resolver, manifest, and negative suite agree on the exact authority set.

## Open Questions

- No implementation-blocking question remains. The named reviewer and the de-identified corpus owner are release inputs recorded in the corpus descriptor and review references; the runtime never infers either.