# Design: order-insensitive alias admission

## Context

Registry 2.0 resolution is a two-stage pipeline with very different characters.

```
raw label ─▶ findAliasAdmissions()      HARD GATE   string-based
                measurement-resolution.ts:553       binary, no scoring
                  │
                  │ candidates: MeasurementDefinition[]
                  ▼
             candidateEvidence()        SOFT RANKER  8 compatibility axes
                measurement-resolution.ts:683        weighted, can only
                  │                                  disqualify or rank
                  ▼
             admissibility  :802-822
```

Line 789 is the failure point:

```ts
for (const { definition, alias } of findAliasAdmissions(input, definitions)) {
```

The candidate set is produced entirely by alias matching. Zero alias hits means
the loop body never runs, `candidates.length === 0`, and line 822 returns
`unmapped`. The ranker never sees the row.

`aliasMatches` (:546) offers four modes, all order-preserving:

| mode | comparison |
| --- | --- |
| `exact` | NFKC-trimmed literal equality |
| `normalized` | equality of the `snakeCaseToken` sequence |
| `ocr_variant` | equality of the `snakeCaseToken` sequence |
| `bounded_fuzzy` | Damerau-Levenshtein over that string, capped at 1 or 2 |

A whole-token permutation is far outside any realistic edit budget. Measured
against `lab_data/sample_lab_report_english_mock.pdf`, moving the abbreviation
from the front of a parenthetical label to the end turns **12 of 38** labels
from a recognised outcome into `unmapped`, while zero labels are unmapped as
printed.

The current scoring budget matters for the design, because it determines how
much slack a new weaker mode has:

```
  alias_exact_match          40      unit_compatible           15
  alias_normalized_match     36      specimen_compatible       10
  alias_ocr_variant_match    28      modifier/timing/method     5
  alias_bounded_fuzzy_match  28      section / neighbour        3
                                     reference_shape            2
  admissibility bar          55   AND missingAxes must be empty
```

`exact(40) + unit(15) = 55` is exactly the bar — the thresholds were tuned so a
perfectly spelled label with a valid unit only just qualifies.

## Goals / Non-Goals

**Goals:**

- A reordered parenthetical label produces the same candidate set, outcome,
  missing axes and conflict codes as the printed ordering.
- Every existing admissibility guard survives untouched.
- The decision trace reports which mode actually fired.
- Order-insensitive admission cannot silently create a new concrete
  resolution that ordered admission would not have reached with the same axis
  evidence.
- The catalog manifest digest is unchanged, so this is a resolver change and not
  a catalog-content change.

**Non-Goals:**

- Growing the catalog with new analytes or new authored aliases.
- Wiring `MeasurementResolutionInput.proposedKey` into scoring. It is threaded
  through the whole pipeline and never read, and `proposed_key_match` is
  reserved but never emitted. Worth closing, but it fails at a different stage
  and would not have fixed this bug.
- Substring, containment, phonetic, embedding or LLM-based matching.
- Any change to the acceptance/correction writer, verification transitions, or
  the review UI.
- Aggregating unmapped labels into a triage funnel. That work depends on this
  fix landing first, otherwise the funnel is dominated by false unmapped rows.

## Decisions

### 1. Widen the gate, leave the ranker alone

The defect is that a correct candidate is never admitted. Three shapes were
considered:

| option | fixes all 12 | generalises | risk | verdict |
| --- | --- | --- | --- | --- |
| Canonicalise `Long name (ABBR)` → `ABBR (Long name)` before resolution | yes | no — only the parenthetical shape | low | rejected: a format rule dressed as a semantic one |
| Author reversed aliases in the catalog | yes | no — next permutation breaks again | lowest | rejected: treats the symptom, grows the catalog with noise |
| Order-insensitive token-set admission | yes | yes — any permutation | medium, mitigable | **chosen** |

The third is the only one that addresses the actual invariant: token order is
not semantically meaningful in a laboratory label.

### 2. Derive token sets from the existing alias corpus, do not author new aliases

`token_set` is a *derived projection*, not a new alias record:

```
   AliasDefinition (unchanged on disk and in the manifest)
        normalizedValue: "alt_alanine_aminotransferase"
                 │
                 │  module-init projection
                 ▼
        tokenSetKey: "alanine|aminotransferase|alt"
                 │
                 ▼
        TOKEN_SET_INDEX: Map<tokenSetKey, AliasDefinition[]>
```

Three consequences, all desirable:

- **No type change.** `AliasDefinition` gains no field, so
  `manifestDefinition()` serialises the same bytes and
  `MEASUREMENT_CATALOG_MANIFEST_DIGEST` is unchanged. This stays a resolver
  change.
- **Authority is inherited, not invented.** The matched alias keeps its own
  `matchAuthority`, `approvalStatus`, `lifecycle` and `provenance`, so every
  EH-110 governance rule applies with no new policy surface. A
  `recognition_only` alias admitted by token set is still barred from `resolved`
  at line 807.
- **Matching stays O(1).** One map lookup on a precomputed key, not a pairwise
  set comparison across 292 aliases.

### 3. `aliasMatches` returns the mode that fired, not a boolean

Today the matched alias carries its authored `matchType` into evidence. That
would be a lie for a token-set admission. Refactor:

```ts
// before
function aliasMatches(alias, rawLabel, normalizedLabel, laboratory): boolean

// after
function matchAliasMode(alias, rawLabel, normalizedLabel, tokenSetKey, laboratory)
  : AliasMatchType | null
```

`findAliasAdmissions` then builds `MatchedAlias` with the fired mode, and
`candidateEvidence` maps it to the reason code. This also makes the ordered
modes self-describing, which they currently are only by coincidence.

Order of evaluation is ordered-first: if `exact` or `normalized` fires, that
mode wins and `token_set` is never consulted. So no currently-resolving row can
change its reported match type.

### 4. Eligibility narrowing: two guards, both free

- **Only `exact` and `normalized` aliases project a token set.** `ocr_variant`
  and `bounded_fuzzy` are already relaxations; stacking a second relaxation on
  top compounds false-positive risk with no evidence of need.
- **Both sides need at least two distinct tokens.** A single-token projection is
  identical to normalized equality, so the restriction admits nothing new and
  removes a class of short-label collisions for free.

Note what is *not* relaxed: token-set equality is exact set equality, not
containment. `neutrophils_absolute_neu` and `neutrophils_neu` have different
sets and must not match — this is asserted explicitly, because containment is
the obvious next thing someone would reach for and it is precisely the
unsafe generalisation.

### 5. Weight: 32, below every ordered mode

```
  exact        40
  normalized   36
  token_set    32     ← new
  ocr_variant  28
  bounded_fuzzy 28
```

Rationale, worked against the bar of 55 with an empty-missing-axes requirement:

```
  token_set(32) + unit(15)                       = 47   → below bar
  token_set(32) + unit(15) + specimen(10)        = 57   → at/above bar
```

So a reordered label with a unit but no stated specimen stays incomplete on a
specimen-bearing definition — which it would anyway, because `missingAxes` is
non-empty and that check is independent of score. The weight matters for the
cases where all axes *are* present, and there 32 still leaves the row
comfortably above the bar. The ordering `token_set < normalized` is the point:
weaker evidence, strictly less credit.

Placing it above `ocr_variant`/`bounded_fuzzy` is deliberate. A permutation
preserves every token exactly; an OCR variant or a fuzzy match does not. Token
set is a *stronger* signal than either, so ranking it below them would be
incoherent.

### 6. Collision invariant enforced statically, scoped to the analyte

The one genuine hazard is two distinct reviewed **analytes** whose labels are
token permutations of each other. Runtime detection would surface as a
mysterious `ambiguous`; build-time detection names both analyte keys.

```
for each reviewed definition
  for each admission-eligible alias
    tokenSetKey → analyteKey
assert: no tokenSetKey maps to two distinct reviewed analyteKeys
```

**Scoping this to the definition key rather than the analyte key was the first
attempt and it was wrong.** The catalog legitimately carries several reviewed
definitions per analyte that differ only by specimen, timing or method, and
they deliberately share aliases: `alanine_aminotransferase` is authored as a
`normalized` alias on both `alt_serum_catalytic_activity` and
`alt_plasma_catalytic_activity`, and `blood_glucose` is shared across the
serum, plasma and whole-blood glucose definitions. The ordered path already
admits those together — that co-candidacy is exactly what feeds the specimen
axis and produces the correct `partial` outcome when specimen is unstated.
A definition-scoped invariant would have failed the build on six pre-existing,
entirely correct catalog entries.

Scoped to the analyte, the current catalog reports zero collisions.

Reviewed-versus-provisional collisions are allowed and expected — a
`recognition_only` fixture sharing a projection with a reviewed definition
cannot reach `resolved`, and the ranker will simply carry both as candidates.
The check runs inside `verify:registry`, so it gates every future catalog edit,
not just this change.

### 7. Trace and version consequences

New reason code `alias_token_set_match` must be admitted in three places:

1. `ResolutionReasonCode` union in `types.ts`
2. `TRACE_REASON_CODES` in `measurement-resolution.ts:877`
3. the 33-value SQL allowlist inside `eh115_validate_resolver_decision_trace`
   (`supabase/migrations/039_eh115_resolver_decision_trace.sql:129-139`)

The third needs a new migration that redefines the validation function. The
change is additive to an allowlist, so every trace persisted under resolver
version `8` remains valid and nothing is rewritten.

`MEASUREMENT_RESOLVER_VERSION` goes `8 → 9`. The catalog manifest version and
digest do not move.

### 8. The resolver bump invalidates all seven approvals — by design

`candidateInputHash` is computed over the resolver version
(`scripts/lib/registry-v2-candidate-corpus.ts:684-692`):

```ts
hashJson({ candidate, inputHashes, catalogManifestVersion,
           resolverVersion, normalizationVersion })
```

Every approval in `registry/candidate-release/v1/approvals.json` is pinned to
`32696937f0c9…e81d6d`. Bumping the resolver moves the hash, and
`validateApprovals` will emit *"approval … is bound to a different candidate
input hash"* for all seven:

```
  registry-safety-review-2026-07-30          registry-safety-reviewer
  release-gate-2026-07-30                    release-manager
  assessment-alt-review-2026-07-30           assessment-owner  alt_serum_catalytic_activity
  assessment-glucose-serum-review-2026-07-30 assessment-owner  glucose_serum
  assessment-glucose-plasma-…                assessment-owner  glucose_plasma
  assessment-glucose-whole-blood-…           assessment-owner  glucose_whole_blood
  assessment-fasting-glucose-…               assessment-owner  fasting_glucose
```

This is the governance working as intended: a change to admission policy is
exactly the kind of change a safety reviewer should look at again. The
re-approval is a human act and the pipeline must not synthesise it. It is called
out as a first-class task rather than discovered during release.

### 9. Expect `unmapped → ambiguous`, and treat that as success

Widening admission does not turn every affected row into `resolved`. ALT with no
stated specimen admits both `alt_serum_catalytic_activity` and
`alt_plasma_catalytic_activity`, has a non-empty `missingAxes`, and therefore
lands on `partial`. Other labels will land on `ambiguous`.

That is a strict improvement. `ambiguous` and `partial` retain candidates,
missing axes, conflict codes and a decision trace; `unmapped` discards all of
it. The acceptance criteria are written in terms of *outcome parity between the
two orderings*, not in terms of how many rows become `resolved`.

## Risks / Trade-offs

- **A permutation-collision between two reviewed definitions would produce a
  wrong candidate pair** → build-time collision invariant in `verify:registry`
  names both keys and fails the build; the check gates all future catalog edits.
- **Token-set equality is one relaxation away from token containment, which
  would be genuinely unsafe** → containment is forbidden in the spec and
  asserted with an explicit negative fixture
  (`neutrophils_absolute_neu` vs `neutrophils_neu`).
- **Rows move from `unmapped` to `ambiguous` in bulk after reprocessing, which
  will look like a regression on a dashboard** → the EH-116 dry run is reviewed
  and its diff classification recorded before any apply; the QA checklist states
  the expected direction of movement explicitly.
- **Seven approvals must be re-signed, which blocks the candidate release on a
  human** → surfaced as an explicit task with the failure mode documented, so it
  is not discovered at release time.
- **Refactoring `aliasMatches` from boolean to mode touches the hottest path in
  the resolver** → the ordered modes are evaluated first and in their existing
  order, so any row that resolves today takes the identical branch; the launch
  corpus with all thresholds at `1.0` and `maxFalseConcreteResolutions: 0` is
  the regression net.
- **This does not fix the underlying cause, which is that the extractor rephrases
  labels non-deterministically** → out of scope here, and arguably the resolver
  should be robust to phrasing regardless; worth a separate look at whether the
  extraction prompt should be instructed to preserve the printed label verbatim.
