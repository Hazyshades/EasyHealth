# Design: reviewed panel specimen policy

## Context

Three facts set the shape of this change.

**The knowledge exists but has no home.** "A complete blood count is whole blood"
is true, useful, and currently encoded nowhere. It is re-derived by an extraction
model on every row of every upload, silently, non-deterministically, and
invisibly in the result. #106 removes that. This change gives the knowledge a
place to live where it can be reviewed once and checked forever.

**The heading is printed but discarded.** The document says
`Complete blood count with manual smear microscopy + ESR`. The column exists,
the resolver already reads it as `section`, and it is `null` on 44/44 rows
because the extraction prompt has no such field and the worker writes a literal
`null`. Capturing it is transcription, which is verifiable, not inference.

**The naive rule is dangerous.** Measured against the current catalog:

```
reviewed definitions with specimen = whole_blood        32
  of which CBC constituents                             30
  of which NOT CBC constituents                          2   glucose_whole_blood
                                                             hba1c_whole_blood
score-affecting whole_blood definitions                  9
  of which CBC constituents                              7   hemoglobin, hematocrit,
                                                             rbc, wbc, platelets,
                                                             rdw_cv, rdw_sd
```

An unnarrowed "CBC heading implies whole blood" rule would let a glucose row
printed under a CBC heading select `glucose_whole_blood` — a score-affecting
binding — on the strength of a section title. That is the same failure #106 was
written to stop, re-introduced through a different door.

## Goals / Non-Goals

**Goals:**

- Haematology results regain concrete identity through one reviewed rule rather
  than per-row model guesses.
- A policy-derived specimen is always distinguishable, in the trace and in the
  evidence, from a specimen the document printed.
- The rule is versioned, digest-covered and approved by a named owner, exactly
  like the rest of the catalog.
- A document reviewer is asked nothing new. Zero new UI decisions.
- A mis-sectioned row cannot inherit a specimen outside the policy's declared
  analyte scope.

**Non-Goals:**

- `Biochemistry ⇒ serum`. A biochemistry panel may be serum or plasma; the
  implication is not safe and the 16 biochemistry rows stay `partial`.
- LLM citation of where a specimen is printed. That is a separate idea, useful
  for documents that *do* print the specimen somewhere we fail to capture, and it
  does not apply to this document at all.
- Any change to what the reviewer is asked. After #106 the manual mapping control
  does not render for these rows, and it must stay that way.
- Per-row overrides, user-supplied specimens, or a UI for editing policies.
- Retroactively fixing stored rows without either re-extraction or the optional
  backfill.

## Decisions

### 1. The policy is a catalog entity, not configuration

ADR 0001 fixes this: *"Catalog entities live in TypeScript. Postgres stores keys,
versions, digests, and provenance snapshots."* A panel policy is catalog
knowledge, so it lives in TypeScript beside the definitions and is serialized
into the release manifest.

That placement is what makes it governable. Being in the manifest means it is
covered by `MEASUREMENT_CATALOG_MANIFEST_DIGEST`, which is covered by
`candidateInputHash`, which is what approvals are pinned to. Add a policy and
every signature detaches — which is exactly the behaviour we want for a rule that
changes what reaches Health Profile.

```ts
type PanelSpecimenPolicy = {
  key: string;                                  // "cbc_whole_blood"
  displayName: string;
  headingForms: readonly string[];              // normalized forms that match
  specimen: SpecimenKey;
  appliesToAnalytes: readonly string[];         // explicit allowlist
  maturity: "reviewed" | "provisional";
  sourceProvenance: MeasurementSourceProvenance;
  reviewReference: string;
};
```

Alternative considered: a JSON file next to `policy.json`. Rejected — it would
sit outside the manifest digest, so the approval hash would not move when the
policy changed, and a rule affecting scoring could ship unsigned.

### 2. Match on normalized heading forms, not regex

`headingForms` holds curated normalized strings compared through the same
`snakeCaseToken` pipeline the aliases use. #105 was a lesson in how brittle
ordered lexical matching is; a small curated form list keeps matching
deterministic, greppable and reviewable, and it fails closed — an unrecognised
heading simply yields no policy.

Launch forms for `cbc_whole_blood`: `complete blood count`, `cbc`, `full blood
count`, `fbc`, plus the Cyrillic `общий анализ крови` / `оак` that the extraction
stack already handles elsewhere.

Regex was considered and rejected: it invites accidental breadth, and a wrong
character class here silently changes which rows feed scoring.

### 3. Narrow by analyte, and exclude glucose and hba1c by name

The policy declares `appliesToAnalytes`. The CBC policy lists the 18 haematology
constituents and therefore covers 30 reviewed definitions. `glucose` and `hba1c`
are excluded explicitly, with a comment saying why, because both have reviewed
whole-blood definitions and both affect scoring.

Alternative considered: derive the allowlist from `CBC_REGRESSION_FAMILIES`.
Rejected — that list is organised around regression *families* (units,
diff-variants) rather than analytes, so the mapping would be indirect and would
silently change whenever the regression suite is reorganised.

### 4. Specimen provenance travels with the input

The resolver currently receives `specimen: string | null` and cannot tell where
it came from. Rather than injecting the policy value and hoping, the input gains
its source:

```ts
specimen: SpecimenKey | null;
specimenSource: "stated" | "reviewed_panel_policy" | null;
```

`evaluateSpecimenCompatibility` then emits a different code per source:

```
   stated by the document        specimen_compatible              weight 10
   reviewed panel policy         specimen_from_reviewed_panel     weight  8
   absent                        specimen_missing                 weight  0  → axis missing
```

Both satisfy the axis, so both clear `missingAxes`; only the first is a claim
about this document. This is the generalisation of the provenance idea deferred
in #106, arriving now because there is finally a second source to distinguish.

### 5. Weight 8, deliberately below a printed specimen

Checked against the admissibility bar of 55 with the CBC labels:

```
  exact alias      40 + unit 15 + panel specimen 8 + modifier 5  = 68  ✓
  normalized alias 36 + unit 15 + panel specimen 8               = 59  ✓
```

Comfortable margin, so the CBC rows resolve. The gap against a printed specimen
(10) is not cosmetic: it means a panel heading alone cannot lift a candidate that
would otherwise sit just under the bar. A printed word is evidence about this
document; a policy is a generalisation, and generalisations should carry less.

The exact figure must be verified against the real CBC set during
implementation, not assumed from these two examples.

### 6. The policy must survive the #106 filter

`stated-axis-evidence.ts` strips any specimen not lexically present in the row's
provenance. A policy-derived specimen is *by definition* not lexically present —
`Complete blood count` contains no "whole blood". So the two changes would fight
unless the ordering is explicit:

```
   row ──▶ #106 filter ──▶ specimen = null, specimenSource = null
                                   │
                                   ▼
              panel policy lookup on section_context
                                   │
                     ┌─────────────┴─────────────┐
                     │ policy matches            │ no policy
                     ▼                           ▼
       specimen = whole_blood            specimen stays null
       specimenSource = reviewed_panel_policy    axis reported missing
```

The filter runs first and unconditionally. The policy is applied afterwards, to
an already-cleaned input, and only ever sets a value the filter had removed. It
can never *preserve* a model guess — if the model guessed `serum` for a CBC row,
the filter drops it and the policy supplies `whole_blood`, not the guess.

### 7. Existing rows need re-extraction, and that is the honest cost

#106 fixes stored rows on read because reprocessing re-runs resolution. This
change cannot do the same, because it depends on `section_context`, which is
`null` on every stored row, and EH-116 reprocessing does not re-run extraction.

Two paths:

| | cost | determinism | risk |
| --- | --- | --- | --- |
| Re-extract affected documents | one LLM call per document | new extraction, may differ in other ways | model nondeterminism reintroduced |
| Backfill from stored `ocr_text` | no LLM | deterministic | heading detection is heuristic |

The backfill is genuinely attractive: `document_pages.ocr_text` is populated
(page 1, truncated at 50k), and each row carries `source_text`, so a row can be
located inside the page text and the nearest preceding heading taken. It avoids
LLM cost and avoids re-rolling every other extracted field.

It is proposed as an **optional** workstream, ordered last, because heading
detection in flat OCR text is heuristic and would need its own fixtures. Default
path is re-extraction.

### 8. Approval scope is per policy, not per definition

`policy.json` currently names owners per measurement key. A panel policy affects
many keys at once, so it needs its own scope:

```json
"panelSpecimenPolicyOwners": { "cbc_whole_blood": "assessment-owner" }
```

The seven score-affecting CBC keys are what the owner is actually signing off:
`hemoglobin_whole_blood`, `hematocrit_whole_blood`, `rbc_whole_blood`,
`wbc_whole_blood`, `platelets_whole_blood`, `rdw_cv`, `rdw_sd`. They are listed
in the approval note so the signature records what was reviewed, not just that
something was.

### 9. Ship in the same candidate as #105 and #106

All three move the approval hash. Three separate release procedures would
produce two intermediate candidates nobody deploys.

```
   #105  order-insensitive alias admission      resolver 8 → 9
   #106  unstated axes cannot be evidence       normalization 5 → 6
   this  reviewed panel specimen policy         catalog manifest + digest
                          │
                          ▼
              registry-v2.0.0-candidate.2
   one hash · one set of approvals · one reprocess review
```

Branch order is #105 → #106 → this, because each depends on the previous being
settled before corpus expectations are finalised.

## Risks / Trade-offs

- **A policy is a medical claim, and this one is signed by the same person who
  wrote it** → true, and unavoidable at current team size. What the mechanism
  buys is that the claim is *written down, dated, scoped to seven named keys, and
  attached to a specific catalog hash* instead of being an unrecorded model
  behaviour. That is a real improvement even when the reviewer is the author.
- **Mis-sectioned rows inherit the wrong specimen** → mitigated by the analyte
  allowlist, and the two dangerous cases (glucose, hba1c) are excluded by name
  with a negative corpus fixture asserting it.
- **Heading text varies by laboratory, so the policy silently stops applying** →
  fails closed to `partial`, which is safe but invisible. The audit script from
  #106 should be extended to report headings that matched no policy, so
  under-coverage is measurable rather than assumed.
- **The precedent invites `Biochemistry ⇒ serum` next** → named as a non-goal
  with the clinical reason. The mechanism deliberately makes each policy a
  separate reviewed entry rather than a general "infer from panel" switch.
- **Existing documents stay empty until re-extracted** → stated plainly in the
  proposal and QA; the optional backfill exists precisely because this cost is
  real.
- **Weight 8 is asserted from two worked examples** → flagged as requiring
  verification across the whole CBC set before the corpus is finalised.
