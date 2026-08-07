# Design: attributable incompleteness

## Context

The resolver produces exactly four outcomes, and that enum is normatively fixed in three
separate specs (`incomplete-laboratory-outcomes` L9, `analyte-measurement-model` L52,
`context-aware-measurement-resolution` L58). `partial` therefore has to absorb several
unrelated situations. Two specs already say so explicitly, in adjacent scenarios:

- *Recognized provisional candidate remains partial* — `context-aware` L60-62
- *Known label with missing identity axis remains partial* — `context-aware` L64-66

Both are correct. The defect is that once they leave the resolver they are
indistinguishable, and the product then speaks to the reviewer as though they were the
same.

The mechanism is a single expression. `resolveMeasurementDefinition` filters ranked
candidates through `admissible` (`measurement-resolution.ts:860-870`):

```ts
const admissible = ranked.filter((candidate) => {
  const definition = definitionByKey.get(candidate.candidateKey)!;
  return (
    definition.maturity === "reviewed" &&
    definition.sourceProvenance.kind === "registry_v2_review" &&
    candidate.matchedAlias.matchAuthority === "reviewed_resolution" &&
    candidate.matchedAlias.approvalStatus === "reviewed" &&
    candidate.missingAxes.length === 0 &&
    candidate.score! >= 55
  );
});
```

Six conjuncts, one boolean out. Only the fifth leaves a trace, because `missingAxes` is
populated earlier by the compatibility evaluators. The other five are silent: a candidate
excluded for maturity records nothing in `rejected`, `missing`, `missingAxes` or
`conflicts`. `CandidateEvidence.eligible` is back-filled from the filter result
(`measurement-resolution.ts:895-900`), but it is one boolean over all six conjuncts and
cannot isolate any of them.

Downstream, `LaboratoryResolutionDetails` is summarized by `summarizeTrace`
(`incomplete-laboratory-outcomes.ts:106`) from a `DecisionTraceLike` whose candidate shape
has no `maturity` key at all, so the projection is *structurally* unable to see it. And
`measurementMappingGuidance(result)` (`biomarker-review-state.ts:13`) takes only the
outcome, so even a correct signal would have nowhere to go.

One partial path exists and is a trap. `PersistedResolverDecisionTraceCandidate` does carry
`maturity` (`types.ts:262`), written at `measurement-resolution.ts:1104`. But it reaches the
UI only through `NormalizationReview.decisionTrace`, which requires an **active revision**
with `resolver_trace_schema_version === "1"` (`normalization-review.ts:155-163`). A row
awaiting first review has no active revision; its payload carries
`previewCandidateEvidence`, typed `CandidateEvidence`, which has no maturity field. So
maturity is absent from the payload at precisely the moment the reviewer reads the copy —
the 44-row document in issue #114 is entirely in that state.

## Goals / Non-Goals

**Goals:**

- Make admissibility rejection attributable at the point of decision, not reconstructed
  afterwards.
- Give every non-`resolved` row a reason class that is available with or without an active
  revision.
- Say something true and specific to the reviewer, including saying "this one is on us"
  when it is.
- Separate, in the counters, what the document owes from what the catalog owes.
- Close issue #63's remaining criterion in the same change, since it is the same defect
  seen from the axis side.

**Non-Goals:**

- Changing the four-outcome enum, or which rows resolve. Behaviour of the resolver's
  *selection* is unchanged; only its *explanation* becomes richer. Corpus expectations and
  the candidate input hash must not move.
- Reviewing the eight provisional definitions. That is a catalog act with its own approval
  scope and release hash.
- Reordering or re-ranking candidates.
- Localization. Copy stays hardcoded English; there is no i18n mechanism in the repo and
  this change does not introduce one.

## Decisions

### 1. Capture the rejection at the filter, do not infer it downstream

**Decision.** Replace the boolean `admissible` filter with one that evaluates the same six
conjuncts and records, per candidate, which ones failed — as evidence on the candidate,
not as a side table.

**Why not infer it in the projection?** Because it is not derivable there. For preview rows
the payload has no maturity at all, and reconstructing "provisional" by re-reading the
catalog in the projection layer would duplicate the admissibility rule in a second place,
where it would drift. The resolver already knows; it simply throws the knowledge away.

**Why not use `eligible`?** It conflates all six conjuncts into one bit. Two rows with
`eligible: false` can be incomplete for opposite reasons — one the reviewer can fix, one
they cannot.

**Alternative considered:** add `maturity` to `CandidateEvidence` and let consumers decide.
Rejected: it exports a catalog attribute to every consumer and invites each to re-implement
the admissibility rule. Recording *the rejection* keeps the rule in one place and makes the
consumer read a conclusion instead of re-deriving one.

### 2. The reason class is a projection, not a fifth outcome

**Decision.** Add a reason class alongside the outcome, never inside it. The four-outcome
enum stays exactly as specified in three specs.

Classes, ordered by precedence when several apply:

| class | meaning | who acts |
| --- | --- | --- |
| `unit_or_value_conflict` | hard conflict rejects the candidate | the document is wrong or unsupported |
| `axis_not_stated` | a required axis is absent from the evidence | the document, by stating it |
| `definition_not_reviewed` | the only candidates are provisional | **the catalog** |
| `no_candidate` | nothing recognized (`unmapped`) | the catalog, by adding an alias |

**Precedence matters and must be explicit.** A row can be both provisional *and* missing an
axis; the twelve rows in issue #114 are provisional with zero missing axes, but the general
case exists. Conflict outranks a missing axis, and a missing axis outranks maturity: telling
a reviewer "the specimen is not stated" is actionable, and stays true even after the
definition is reviewed. Reporting maturity first would send them away from the one thing
they could still do.

### 3. `definition_not_reviewed` must not present as actionable

**Decision.** Its copy states that the measurement is recognized and awaiting catalog
review, that the raw result is preserved, and offers no supply-this-detail affordance. The
existing EH-117 requirement that raw acceptance be offered on every non-`resolved` row
still holds — accepting as reported remains the correct and only action.

This is the clinical-safety core of the change. A reviewer who believes a detail is missing
may go looking for it, and the most available "fix" is to guess a specimen. #106 removed
the machine's ability to guess; copy that nudges a human into the same guess reopens the
hole from the other side.

### 4. Name the axis at row level, reusing the existing label helper

**Decision.** Render the specific missing axes in the row-level guidance, using
`measurementReasonLabel`, and extend `REASON_LABELS` to cover what it is actually fed.

Today it holds seven entries, includes a dead `unit_conflict` key that is not a member of
`ResolutionReasonCode`, has no entry for `modifier`, `timing` or `method`, and is also
called with bare `ClinicalCompatibilityAxis` values
(`review-technical-details.tsx:78`) that all fall through to
`code.replaceAll("_", " ")`. So a reviewer can already be shown the token `value_kind`. The
data for #63 is present — `NormalizationReview.missingAxes` — only the copy is missing.

### 5. Split the counter into three, not two

**Decision.** `summarizeReviewRows` reports incomplete rows split by who can act:
awaiting-document, awaiting-catalog, and conflicted. `total` and `resolved` are unchanged.

A two-way split would put `unit_or_value_conflict` on the wrong side; a conflicted row is
not waiting on catalog review, and describing it as such would be a new inaccuracy in place
of the old one.

`hasIncompleteOutcomes` drives the document-level reprocess affordance. A row blocked only
by maturity will not improve on reprocess against the same catalog release, so it should
not, on its own, offer one. This is a behavioural change beyond copy and is called out as a
task rather than folded in silently.

### 6. Archive EH-117 and EH-118 before writing deltas

**Decision.** Archive both merged changes first, then anchor deltas on the resulting spec
text.

`openspec/specs/observation-review-workspace/` does not exist yet, and
`incomplete-laboratory-outcomes` L27, `document-extraction-review` L133 and L259 all carry
pending EH-117 MODIFIED deltas. Writing a second MODIFIED against the archived text would
restore the pre-EH-117 wording and silently revert it. Both changes are complete (27/27 and
32/32) and merged, so archiving is bookkeeping that is already owed.

## Risks / Trade-offs

**A reason class becomes a second place the admissibility rule is expressed, and drifts
from the filter.** → Derive the class from recorded evidence only. No consumer may re-read
the catalog or re-evaluate a conjunct; if the class cannot be derived from evidence, the
evidence is the bug.

**Widening `measurementMappingGuidance` breaks four call sites at once.** → Intended. An
arity change is a compile error, which `pnpm typecheck` catches in CI. A string-only change
would not be caught, because none of the three suites asserting this copy run in CI
(issue #110). Prefer the failure mode that is visible.

**The metric key set is asserted exactly** (`verify-eh112` L213-227), so adding the reason
class to `ResolutionOutcomeMetric` breaks it. → Update the assertion in the same change,
deliberately. The metric is privacy-scoped: the class is a closed enum with no free text and
no candidate key, which keeps the existing allowlist guarantee intact.

**Reason-class copy could leak a candidate key**, which `verify-eh112` L138 and
`verify-eh117` L237-247 explicitly guard. → The class is an enum; the copy is derived from
the class and the axis names, never from a candidate. Keep those guards and add one for the
new copy path.

**Splitting the counters changes a number users may already read** (`44 incomplete` becomes
`32 + 12`). → That is the point, and the total remains available. Say it in the QA
checklist so a tester does not file the intended change as a regression.

**Scope creep into catalog review.** Making the twelve rows legible will immediately raise
"then just review the definitions". → Out of scope by decision, and cheap to do separately.
Legibility and the catalog decision must not be entangled in one release, because the
second needs signatures and moves the candidate hash.

**Retired definitions.** `MeasurementMaturity` includes `retired`, which is excluded from
candidate generation entirely rather than at admissibility, so it should surface as
`no_candidate`, not `definition_not_reviewed`. → Verify with a fixture rather than assuming;
if a retired definition can reach admissibility, the class taxonomy needs a fourth member.

## Migration Plan

No data migration. No stored column changes. The reason class is computed on read from
evidence already produced, so existing rows gain it the moment they are re-projected, and no
backfill is required.

Resolver *selection* is unchanged, so `MEASUREMENT_RESOLVER_VERSION` and the candidate input
hash must not move. If either moves, the change has altered behaviour it promised not to,
and that is the signal to stop: `registry-v2.0.0-candidate.2` and its seven approvals would
otherwise be invalidated for a copy fix.

Rollback is a revert. Nothing is written that a previous build cannot read.

## Open Questions

- Does the persisted decision trace need the rejection reasons too, or is the read-time
  projection sufficient? Persisting them makes historical rows explainable and costs a trace
  schema version; not persisting them keeps this change smaller. Recommend: not now, and
  record the reason in the trace-schema note so the next version picks it up deliberately.
- ~~Should `definition_not_reviewed` rows be excluded from `hasIncompleteOutcomes`?~~
  **Resolved during implementation: excluded.** Reprocessing re-runs the resolver against
  the deployed catalog release, and a row held back only by definition maturity returns the
  same verdict, so the affordance could never do anything. Offering it would be the same
  false promise this change removes from the copy, one layer down. A reviewer who wants
  those rows resolved needs the definitions reviewed, which is a catalog release, not a
  button. The QA checklist states this so the disappearing affordance is not filed as a
  regression.
