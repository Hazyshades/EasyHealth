# Design: unstated axes must not behave as stated evidence

## Context

The rule is not new. `analyte-measurement-model` already says unknown
information "MUST NOT behave as positive compatibility evidence", and already
carries the ALT-without-specimen scenario. The resolver implements it correctly:
43 of 52 launch-corpus rows have no specimen, all expect `partial`, all pass.

The defect is in the seam the corpus does not cross.

```
  ┌──────────┐      ┌────────────┐      ┌─────────────────┐      ┌──────────┐
  │ document │─────▶│ extraction │─────▶│ extracted row   │─────▶│ resolver │
  └──────────┘      │   (LLM)    │      │ (Postgres)      │      └──────────┘
                    └────────────┘      └─────────────────┘            ▲
                          │                                            │
                 specimen invented here            52 fixtures ────────┘
                          │                        feed the resolver
                          ✗ no gate                 DIRECTLY, skipping
                                                    everything to the left
```

Measured on `f0a8d0c2-…` (`sample_lab_report_english_mock.pdf`, 44 rows):
`specimen` concrete on 44/44, `method` null on 44/44, and the strings
`serum` / `plasma` / `whole blood` absent from the PDF bytes entirely. The
`method` column is the control group — EH-113 gave it a "do not infer"
instruction and it holds.

Two facts constrain the fix.

**Fact 1: the resolver cannot tell the difference.** `input.specimen` is a bare
string. `evaluateSpecimenCompatibility` awards `specimen_compatible` at strength
`strong`, and the axis leaves `missingAxes`. Since admissibility requires
`missingAxes.length === 0`, a fabricated specimen is *precisely* what unlocks
`resolved`.

**Fact 2: a write-time-only fix leaves every existing row broken.** EH-116
reprocessing re-runs the **resolver**, not the extractor. Rows already stored
with a fabricated specimen would keep resolving concretely forever unless we
either re-extract every document (LLM cost, new nondeterminism) or guard on read.

## Goals / Non-Goals

**Goals:**

- An axis the document does not state cannot satisfy a compatibility axis, cannot
  clear `missingAxes`, and cannot by itself produce `resolved`.
- Rows already stored with a fabricated axis are corrected without re-extraction.
- The extractor stops writing fabricated axes into new rows.
- A deterministic check can answer "does any row claim an axis its own provenance
  does not contain" for a given document, at upload time.
- Release evidence covers the extraction seam, so this class cannot pass every
  threshold again.

**Non-Goals:**

- A reviewed per-panel specimen policy (for example "CBC implies whole blood").
  That is a legitimate future capability and is explicitly left for later; this
  change only stops the *undeclared* version of it.
- The `modifier: "<"` parsing artifact from `C-reactive protein | < 0.20`. Same
  symptom class, different cause — the `<` **is** lexically present in the
  snippet, so the stated-evidence test passes it. Separate issue.
- Changing resolver scoring, the compatibility axes, the catalog, the writer, or
  verification transitions.
- Re-extracting existing documents.

## Decisions

### 1. Define "stated" lexically, against provenance we already capture

An axis value is **stated** when its lexical form occurs in provenance already
recorded for that row:

- the row's own `source_text`, or
- the `section_context` it was printed under.

Nothing else counts. No prevalence, no analyte knowledge, no panel semantics.

Why lexical rather than semantic: it is deterministic, cheap, explainable to a
reviewer, and testable without a model. It will under-approximate — a document
that states the specimen in a page header we never captured will be treated as
unstated — and that error direction is the safe one: it produces `partial`, which
loses no data and invites explicit review.

Crucially, `section_context` is not a workaround; it is what the existing spec
already sanctions with the phrase *"and available context cannot prove it"*. A
`Serum chemistry` heading genuinely does state serum. `Complete blood count`
does not contain "whole blood", so CBC rows stay unstated under this policy —
correct, and left to the future reviewed panel policy.

### 2. Enforce on read, not only on write

```
   extraction parser   ──▶  new rows stored clean          (hygiene)
   input projection    ──▶  ALL rows resolve clean         (the actual fix)
   resolver            ──▶  unchanged
```

**There are two row-to-input builders, not one.** The original claim that
`measurementInputFromExtracted` is the single chokepoint was wrong:

| builder | module | used by |
| --- | --- | --- |
| `measurementInputFromExtracted` | `normalization-review.ts:65` | review preview, `compatibleManualDefinitions` |
| `measurementInputFromWriterRow` | `observation-normalization-writer.ts:132` | acceptance/correction writer, EH-116 reprocessing (`registry-reprocessing/diff.ts:67`) |

Filtering only the first would have left the writer and reprocessing untouched —
that is, the two paths that actually persist identity. The policy is applied in
both, sharing one predicate module (`stated-axis-evidence.ts`) that imports
neither catalog nor resolver so both builders can use it.

`measurementInputFromExtracted` also had to gain `source_text`; its row type
carried `section_context` only. Every API select that feeds it already returns
the column, so no query changed.

The write-time filter is still worth having so the database stops accumulating
fiction and so the static check has something meaningful to assert — but it is
the secondary guard, not the primary one. Ordering the tasks the other way round
would ship a fix that appears to work on new uploads and silently leaves the
existing corpus wrong.

### 2b. `section_context` is captured nowhere, so the context escape hatch is inert

Decision 1 leans on `section_context` as the legitimate way a document can state
a specimen at panel level. On real data that path is dead: the column is `null`
on 44/44 rows because the lab extraction prompt has no `section_context` field
and `worker/src/pipeline.ts:460` writes a literal `null`.

The document does print `Biochemistry and inflammation` and
`Complete blood count with manual smear microscopy + ESR`. Capturing those is
honest provenance recording, not inference, and it is a prerequisite for any
future reviewed panel policy. It does not by itself restore anything, because
neither heading contains specimen wording.

Consequence measured on `f0a8d0c2-…`: the strict policy takes the document from
`27 resolved / 17 partial` to `0 resolved / 44 partial`, and a hypothetical
CBC-panel policy recovers nothing while `section_context` stays empty.

### 3. Keep the discarded inference, but only as observability

Dropping the model's guess entirely loses the answer to "how often, and on which
axes, does the extractor fabricate" — which is exactly the data a future panel
policy needs, and exactly the signal that would have surfaced this defect months
earlier.

So: record discarded inferences in one additive nullable `jsonb` column on
`document_extracted_biomarkers`, never read by the resolver, never copied onto
observations, never part of identity. Explicitly non-authoritative.

This is deliberately a **separate workstream, ordered after the safety fix**. If
the column is contested in review it can be dropped without touching anything
that makes the system safe.

### 4. Version axis: normalization, not resolver

Resolver logic does not change. What changes is how an extracted row is
normalized into resolver input — which is what
`MEASUREMENT_NORMALIZATION_VERSION` exists to describe. Bump `5` → `6`, and bump
the extraction `processing_version` for the prompt/parser change.

`MEASUREMENT_RESOLVER_VERSION` stays where #105 leaves it. `candidateInputHash`
covers `normalizationVersion`, so the approvals invalidate either way.

### 5. Ship with #105 as a single candidate release

Both changes invalidate the same seven approvals, for the same mechanical reason.
Sequencing them as two releases means running the re-approval procedure twice and
producing an intermediate release that nobody will ever deploy.

```
   #105  token_set admission          resolver 8 → 9
   #106  stated-axis projection       normalization 5 → 6
              │
              ▼
     one candidate: registry-v2.0.0-candidate.2
     one hash, one set of seven re-approvals, one reprocess dry run
```

#106 lands second in the branch order because its corpus and fixture work
depends on #105's alias behaviour being settled — otherwise the expected
classifications shift twice.

### 6. Expect and communicate `resolved → partial`

On the sample document up to 27 rows lose concrete identity. That is the point of
the change. Two consequences must be handled rather than discovered:

- **Launch fixtures may encode the current behaviour.** Any fixture that expects
  `resolved` while supplying an unstated specimen is asserting the bug. Those
  expectations must be re-examined one by one, not bulk-updated.
- **Health Profile loses inputs.** Rows that fed assessment stop feeding it. The
  reviewer-facing wording must explain why a familiar test now reads
  **More details needed**, or the change will be read as a regression and
  "fixed" by someone re-adding the inference.

## Risks / Trade-offs

- **Lexical matching under-approximates: a specimen stated somewhere we did not
  capture reads as unstated** → error direction is safe (`partial`, raw evidence
  intact, explicitly reviewable). Mitigation if it proves common: widen captured
  provenance, not the inference.
- **Up to 27 rows on one document lose concrete identity, which looks like a
  large regression** → expected and specified; QA checklist states the direction
  explicitly and the automated fixtures assert it.
- **Launch fixtures may currently encode the defect, so "fix the fixtures" could
  quietly re-encode it** → each affected expectation is reviewed individually and
  the change records which fixtures changed and why; no bulk expectation rewrite.
- **CBC rows become `partial` en masse, and the pressure to add a panel-implies-
  whole-blood rule will be immediate** → that rule may well be right, but it must
  arrive as reviewed catalog policy with its own reason code and approval, not as
  a quiet reinstatement. Named as a non-goal here for exactly that reason.
- **A read-time filter means stored data stays wrong on disk** → accepted
  deliberately: the alternative is re-extraction. The static check makes the
  divergence visible, and the write-time filter stops it growing.
- **Adding a seam check to release evidence adds a new way for a candidate to be
  blocked** → intended. The defect passed eight thresholds at `1.0` and seven
  approvals; one more gate at the right place is the cheapest lesson available.
