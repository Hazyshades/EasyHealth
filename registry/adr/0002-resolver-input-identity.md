# ADR 0002: Resolver input identity

- **Status:** Accepted contract; implemented by
  `prepare-resolver-evidence-identity`
- **Date:** 2026-09-11
- **Direct dependencies:** EH-106, EH-115, EH-116, EH-120
- **Scope:** Resolver input identity, shared evidence admission, normalization
  writers, reprocessing diffs, historical restoration, and the corpus-consumer
  seam

## Scope boundary

This ADR records item 1, **Make Resolver decision identity deep**, together
with item 2, **Collapse duplicate evidence admission**, from
`docs/grill/Resolver + specimen/architecture-review-Resolver + specimen.html`.
Item 2 is a prerequisite inside the same Change A, not a separate OpenSpec
change: identity is computed from the prepared evidence consumed by Resolver.

This ADR does not implement or decide the neighboring candidates:

- persisted-decision historical reads (item 3);
- Registry release identity (item 4); or
- redesign of the complete corpus runner and fixture set (item 5).

The corpus is a consumer of the shared preparation and identity contracts, but
its full runner redesign remains separate. The existing
`add-reviewed-panel-specimen-policy` change remains the source of catalog
policy and approval rules; this ADR records the runtime admission ownership and
cutover that prevents per-builder and Resolver-side duplication.

## Context

`buildInputEvidenceHash` currently describes a shallow raw-resolution input. It
omits `specimenSource` and hashes the raw `section` value. A stated specimen and
a reviewed-panel specimen can therefore share one hash despite carrying
different evidence, while equivalent policy headings can produce different
hashes through their wording.

The hash is already distinct from the writer request hash. The gap is the
historical identity of the prepared Resolver input and the ability of
reprocessing to compare that identity without reinterpreting old records.

## Decision

EasyHealth defines **Resolver input identity** as the canonical identity of the
prepared evidence supplied to one Resolver evaluation, including
resolution-relevant provenance context. It is independent of:

- the Resolver outcome;
- the persisted decision trace;
- the Registry release, catalog manifest, Resolver version, or normalization
  version; and
- the reviewer action or writer idempotency request.

The existing `input_evidence_hash` storage field remains the persisted hash
name for compatibility. Its semantic meaning is the Resolver input identity
hash.

### Shared evidence-admission ownership

The shared evidence-admission seam owns the row-to-Resolver admission order:
effective override/value normalization, stated-axis provenance filtering,
sentinel canonicalization, and reviewed panel-policy admission. It returns one
prepared evidence record with a policy context of `stated`, `applied`,
`no_match`, or `conflict`.

The panel matcher must distinguish zero from multiple distinct policy matches;
multiple heading forms for one policy count once. A conflict preserves stable
sorted policy keys, admits no effective specimen, and fails closed with an
allowlisted hard trace reason. A policy-derived specimen is restricted to its
declared source analyte and reviewed allowlist.

Review, writer, correction, reprocessing, preview, and corpus paths consume
thin source adapters over this seam. The same prepared record is passed to
Resolver, identity hashing, trace construction, writer payloads, and
eligibility. Raw captured headings remain source provenance but are not
Resolver policy input or identity fields. Active persisted reads and undo use
their historical contracts; only an unlinked/no-active-row Health Profile
preview uses this seam.

### Canonical prepared record

The identity module receives the prepared Resolver input from the shared
evidence-admission seam. It does not apply stated-axis filtering or panel
policy itself; that remains the admission seam's responsibility. Resolver and
the identity module must receive the same prepared record.

The format-1 canonical record is a flat, allowlisted record. Its object keys
are emitted in this order:

```text
{
  formatVersion: "1",
  rawLabel,
  rawUnit: string | null,
  rawValueText: string | null,
  valueKind: "numeric" | "qualitative" | "ordinal" | "text" | null,
  effectiveValue: number | null,
  effectiveValueText: string | null,
  effectiveValueKind: "numeric" | "qualitative" | "ordinal" | "text" | null,
  effectiveUnit: string | null,
  effectiveOrdinal: number | null,
  specimen: string | null,
  specimenSource: "stated" | "reviewed_panel_policy" | null,
  sourceAnalyteKey: string | null,
  policyContext: {
    disposition: "stated" | "applied" | "no_match" | "conflict",
    key: string | null,
    conflictingKeys: string[],
    effectiveSpecimen: string | null,
    source: "stated" | "reviewed_panel_policy" | "none" | "unknown"
  },
  modifier: string | null,
  timing: string | null,
  method: string | null,
  sectionSupport: boolean,
  neighbourLabels: string[],
  referenceLow: number | null,
  referenceHigh: number | null,
  proposedKey: string | null,
  laboratory: string | null
}
```

- Raw measurement label, raw unit, and raw value text remain evidence fields.
  The effective value, value kind, unit, ordinal, and reference bounds preserve
  the measurement after an explicit correction override. Comparator text stays
  textual evidence; it is not converted into a numeric value.
- Effective specimen and provenance source are explicit. Stated
  `whole_blood` and policy-derived `whole_blood` remain different identities.
- `policyContext` contains the canonical applied key when present, sorted
  conflicting policy keys for `conflict`, the no-match/conflict disposition,
  effective specimen, and source provenance. Equivalent heading forms
  therefore produce the same identity. Registry source-record identifiers are
  provenance metadata, not identity fields.
- Absent and explicit `null` are equivalent. `neighbourLabels` is normalized,
  deduplicated, and sorted in format-1 order. Object keys are emitted in the
  order shown above.
- Extraction confidence, writer action state, raw captured headings, raw OCR
  content, and arbitrary source-row fields are excluded.
- The format version is itself part of the hashed record. Direct Resolver
  fixtures use this same format-1 record; they do not define a second identity
  schema.
A missing provenance value in a legacy record is `unknown`, not negative
evidence. It must not be interpreted as proof that the source did not state an
axis.

### Consumers and versioning

The regular writer, automatic-verification writer, reprocessing diff, and the
future corpus adapter consume the same identity function. The Resolver trace
stores the resulting hash, but release/version facts remain separate trace
fields.

New normalization revisions persist `input_identity_format_version` alongside
the existing hash. Existing revisions retain their hashes unchanged and have
no fabricated format version. No historical hash is rewritten or backfilled.

Hashes may be compared as equal or changed only when their format versions are
known and equal. A legacy hash without a format version is immutable historical
fact, not a new-format input. Reprocessing reads the prior stored hash and
format version; it never recomputes a prior identity from current code.

Where prior/next hashes are copied into Registry reprocessing rows or the
observation change ledger, their prior/next format versions are copied too.
This preserves interpretation without merging identity version with Registry
release or decision-trace schema version.

## Required implementation shape

The contract is not implementation-ready until all of the following are
addressed:

1. Define the canonical record and identity function without embedding a second
   evidence-admission or Registry-release implementation.
2. Make writers and reprocessing use the same prepared record and identity
   function. Reprocessing must read the stored prior hash/version.
3. Add a nullable persistence field for `input_identity_format_version`, leave
   legacy rows untouched, and update regular, automatic, correction/reversal,
   and reprocessing persistence paths.
4. Propagate prior/next identity versions through history records that carry
   hashes.
5. Expose the identity function as the seam consumed by the separate corpus
   adapter work.
6. Add independent evidence for stated-versus-policy provenance, equivalent
   policy headings, meaningful context changes, absent/null canonicalization,
   legacy-version handling, and release changes that leave the input hash
   unchanged.

### Health Profile marker invariant

This identity decision does not change the existing EH-164 behavior. A
comparator or detection-limit marker may remain an accepted textual Health
Profile input with `value: null` and `value_kind: "text"`. It is retained as
factual evidence, but it is never a numeric score or trend contribution.

Therefore, **assessment admission** and **numeric score contribution** are
separate decisions. The identity module must not turn `non_numeric_value` into
report-only behavior or remove an accepted marker. If a predicate is named
`evaluateAssessmentEligibility`, its contract must state which of those two
decisions it owns; this ADR does not change that ownership or product behavior.

## Explicit non-goals for this ADR

- Do not add the persisted-decision historical-read module; that is item 3.
- Do not change Health Profile admission, `evaluateAssessmentEligibility`, or
  censored-result presentation; those remain separate product contracts.
- Do not centralize Registry release construction; that is item 4.
- Do not redesign the complete corpus runner, fixture set, or launch
  thresholds; this ADR only requires the thin shared-seam adapter.
- Do not rewrite existing legacy hashes or silently backfill identity versions.

## Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Include Registry release or Resolver version in the input identity | Release/version facts are separate axes; unchanged prepared evidence must retain its identity across releases |
| Hash raw captured headings | Equivalent policy headings would diverge and source wording would leak policy representation into identity |
| Recompute a legacy prior hash during reprocessing | Current canonicalization cannot reinterpret immutable historical evidence |
| Treat provenance source as incidental when specimen values match | Stated and policy-derived evidence carry different audit meaning and Resolver weight |
| Use the writer request hash as decision identity | Request identity includes actor/action state and is not the prepared Resolver input |

## Evidence references

- `docs/grill/Resolver + specimen/architecture-review-Resolver + specimen.html`
- `src/lib/biomarkers/types.ts`
- `src/lib/biomarkers/measurement-resolution.ts`
- `src/lib/biomarkers/panel-specimen-policy.ts`
- `src/lib/documents/stated-axis-evidence.ts`
- `src/lib/documents/normalization-review.ts`
- `src/lib/documents/normalization-revisions.ts`
- `src/lib/documents/observation-normalization-writer.ts`
- `src/lib/registry-reprocessing/diff.ts`
- `src/lib/registry-reprocessing/selection.ts`
- `src/lib/registry-reprocessing/types.ts`
- `scripts/lib/registry-v2-candidate-corpus.ts`
- `supabase/migrations/020_measurement_normalization_revisions.sql`
- `supabase/migrations/033_eh106_atomic_observation_normalization_writer.sql`
- `supabase/migrations/039_eh115_resolver_decision_trace.sql`
- `supabase/migrations/041_eh116_registry_reprocess_batches.sql`
- `supabase/migrations/051_eh121_observation_change_history.sql`
- `supabase/migrations/054_eh122_batch_verification_reversal.sql`
- `supabase/migrations/060_eh120_verification_transitions.sql`
