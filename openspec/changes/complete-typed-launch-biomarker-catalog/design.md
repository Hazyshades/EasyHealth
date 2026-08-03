## Context

Registry 2.0 already has reviewed concrete definitions for serum total bilirubin, serum/plasma ALT and AST catalytic activity, and serum CRP. The 44-row launch corpus also contains total protein, direct bilirubin, ASO, ESR, parasitology serology, total IgE, and ECP. Those rows are recognised through provisional `sample_*` definitions that use a display-only unit policy, so a numeric source unit produces `unit_not_accepted` and the shared candidate-release gate reports only 72.7% unit coverage.

The resolver deliberately returns `partial` when recognised evidence cannot select one reviewed concrete identity. That contract is correct and must remain. The defect is that placeholder definitions encode no compatible unit knowledge, so the report conflates known-but-incomplete measurements with untyped unit evidence.

This affects the `documents` normalization pipeline and the `health-profile` registry. Candidate-release inputs are content-addressed: every catalog, corpus, policy, or document-fixture change produces a new candidate input hash and requires governed approvals.

## Goals / Non-Goals

**Goals:**

- Represent every mandatory launch-corpus row with a typed Registry 2.0 definition and an explicit unit policy, including unitless qualitative tests.
- Retain non-concrete outcomes when the source omits discriminating specimen, method, or other identity evidence.
- Remove duplicate display-only fixture candidates where an existing reviewed definition already represents the same analyte and source unit.
- Keep specialty serology/allergy entries visible and unit-aware without making them assessment inputs.
- Make the candidate report distinguish accepted source units from true unit conflicts while still rejecting unsafe concrete mappings.

**Non-Goals:**

- Do not infer serum, plasma, method, timing, or reference ranges from labels or values.
- Do not create clinical assessment bindings, scoring rules, diagnosis logic, external-code mappings, or clinical reference ranges for new provisional definitions.
- Do not reintroduce Registry v1, a fallback matcher, or a dual runtime.
- Do not treat hash-bound approvals as editable implementation data; reviewers must issue fresh approval evidence for the final candidate hash.

## Decisions

### Promote launch fixtures to typed provisional definitions

Every currently display-only sample row without a compatible reviewed definition receives a provisional `MeasurementDefinition` with `sourceProvenance.kind: "sample_fixture"`, a specific analyte key, typed property/scale/value-kind, accepted source unit(s), and no assessment bindings. Provisional is the correct maturity because source fixtures establish recognition and unit semantics but do not alone establish a clinically reviewed concrete identity.

Alternative: make every missing row `reviewed`. Rejected: this would convert incomplete source context into runtime-eligible identities and could affect downstream consumers without clinical review.

### Reuse reviewed definitions and remove shadow candidates

For total bilirubin, ALT, AST, and CRP, use existing reviewed definitions as candidates for their exact aliases and accepted units. Delete overlapping `sample_*` aliases/definitions that inject a contradictory display-only candidate into resolver evidence.

Alternative: retain the shadow definitions and change the report to ignore their conflicts. Rejected: the resolver evidence would remain internally contradictory and conceal a malformed catalog.

### Separate unit knowledge from concrete eligibility

A row is unit-covered when its source unit is known and accepted by at least one recognised typed candidate, or it is an intentionally unitless qualitative result. Concrete resolution continues to require exactly one compatible reviewed definition with no missing axes. A row may therefore be unit-covered and still correctly resolve as `partial`.

Alternative: define unit coverage as only a fully concrete resolution. Rejected: it makes the release gate demand inferred specimen/method values and conflicts with the partial-recognition safety contract.

### Keep specialty definitions display/review-only

Giardia, helminth IgG tests, total IgE, ECP, ASO, ESR, direct bilirubin, and total protein definitions receive empty `assessmentBindings`. Qualitative ELISA entries use intentional unitless handling; coefficient/titer entries use explicit arbitrary-unit policies. No conversion is supplied unless the existing reviewed conversion is applicable.

Alternative: bind these rows to existing scoring systems. Rejected: neither the corpus nor the current scope establishes reviewed assessment semantics.

### Treat approval evidence as an external release decision

The implementation produces the final manifest and hash, runs deterministic safety checks, and records the exact approvals required. It must not invent reviewer names, approval identifiers, or approval hashes. The gate remains non-launchable until Registry Safety, every required Assessment Owner, and the Release Manager approve the final candidate.

## Risks / Trade-offs

- **A provisional definition might later need a more specific specimen/method split.** Preserve raw evidence and keep concrete eligibility disabled; add a reviewed split only with source evidence.
- **Removing shadow aliases can reveal an existing alias collision.** Registry validation and focused resolver tests must run before candidate evidence is regenerated.
- **The unit-coverage metric could be weakened accidentally.** Tests must prove an unknown or dimension-conflicting unit still fails coverage and blocks launchability.
- **The catalog manifest change invalidates all current approvals.** This is intentional; release ownership must review the exact final input rather than reusing old evidence.
- **The existing EH-114 branch contains related candidate-release changes.** Implementation must incorporate the intended merged baseline rather than overwrite its glucose corpus, policy, or approval requirements.