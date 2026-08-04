## Context

EH-106 made Registry 2.0 the sole laboratory identity authority. Its reviewed
catalog already contains separate serum, plasma, whole-blood, and fasting
plasma definitions, but it has no reviewed urine glucose or post-prandial
definition. The resolver represents timing through a definition's identity
tuple and `requiredModifiers`; it does not currently model post-prandial timing
as a first-class timing value. Any absent required axis produces `partial`,
which is the safe behavior to preserve.

The affected domain is **documents**: raw laboratory evidence is extracted,
normalized, and resolved into the active Registry 2.0 definition before
downstream consumers use it. The release candidate corpus is the reproducible
governance evidence for resolver behavior.

## Goals / Non-Goals

**Goals:**

- Make serum, plasma, whole blood, urine, fasting, and post-prandial glucose
  identities separately reviewed and resolvable from explicit evidence.
- Preserve an unknown specimen or timing axis as a non-concrete result, with
  candidate evidence that explains what is missing or conflicting.
- Permit the reviewed `mg/dL` ↔ `mmol/L` glucose conversion only on numeric
  blood glucose definitions; never apply it to urine qualitative/dipstick
  glucose.
- Establish stable candidate-corpus coverage for every required positive and
  negative variant.

**Non-Goals:**

- Do not infer a specimen, fasting state, meal timing, or clinical assessment
  input from a generic label.
- Do not create a database migration, alter the frozen Registry v1 baseline,
  or introduce external-code mappings. External codes remain absent until a
  separate reviewed source and approval are supplied.
- Do not change clinical reference ranges, diagnosis logic, or user interface
  workflows.

## Decisions

### Model post-prandial as a concrete timing identity plus required source modifier

Add `post_prandial` to `MeasurementTimingKey` and define a reviewed numeric
plasma glucose definition with `timing: post_prandial` and a matching required
modifier. Keep fasting as the existing first-class timing identity. This keeps
the registry identity tuple truthful and prevents a post-prandial label from
falling into generic point-in-time glucose.

Alternative considered: record both fasting and post-prandial as untyped
modifiers on point-in-time definitions. Rejected because timing would then be
absent from the identity tuple and downstream code could collapse distinct
measurements.

### Keep urine glucose qualitative and method-specific

Add a reviewed urine glucose dipstick/presence definition with `valueKind:
qualitative`, `method: dipstick`, and display-only unit policy. It receives no
numeric glucose conversion or metabolic assessment binding.

Alternative considered: use the blood glucose numeric definition for urine
units. Rejected because urine dipstick evidence is a different specimen,
method, value kind, and clinical meaning.

### Resolve only when all concrete axes match

Use existing resolver candidate evidence to match specimen, modifier/timing,
value kind, and units. Add explicit aliases for the reviewed glucose contexts.
When a matching candidate lacks specimen or required timing evidence, preserve
the candidate and return `partial`; conflicts reject that candidate. Generic
glucose with several compatible concrete candidates remains `partial` or
`ambiguous`, never resolved by preference order.

Alternative considered: default generic glucose to serum or fasting plasma.
Rejected because neither inference is supported by source evidence.

### Make candidate evidence the release gate

Expand the de-identified candidate corpus and its static runner assertions for
serum, plasma, whole blood, urine dipstick, fasting, post-prandial, unknown
specimen, unknown timing, incompatible unit, and false-concrete regression.
Regenerate the reviewed candidate inputs and approvals only through the
existing governed release workflow when their input hash changes.

## Risks / Trade-offs

- [Ambiguous generic glucose may remain non-concrete more often] → Preserve raw
  evidence and expose candidate keys; require explicit source metadata or a
  reviewed manual correction before a concrete identity is selected.
- [Post-prandial text variants may be missed] → Start with explicit reviewed
  aliases and fixtures; add laboratory-specific aliases only with source
  evidence and review.
- [Candidate corpus hash invalidates prior approvals] → Update the governed
  candidate release artifacts and approval evidence together; the runner must
  remain non-launchable until exact-input approvals exist.

## Migration Plan

1. Add the timing type and reviewed definitions without changing persistence.
2. Extend resolver and corpus tests, then run the registry verification suite.
3. Regenerate governed candidate-release evidence and obtain the existing
   required approvals before promoting a release candidate.
4. Roll back by reverting the additive catalog and corpus change; active
   observations retain raw evidence and are not mutated by corpus evaluation.

## Open Questions

- None for implementation. Candidate external-code mappings are deliberately
  deferred pending a reviewed clinical source.
