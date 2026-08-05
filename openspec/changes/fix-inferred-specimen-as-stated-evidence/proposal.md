# Fix inferred specimen treated as stated evidence (#106)

## Why

`analyte-measurement-model` already forbids this, in almost these words:

> Unknown information SHALL be represented explicitly and MUST NOT behave as
> positive compatibility evidence.
>
> **WHEN** a source does not state specimen and available context cannot prove
> it — **THEN** the resolver does not select a serum, plasma, whole-blood, or
> urine definition solely from prevalence.

The resolver honours that rule. 43 of the 52 launch-corpus rows carry no
specimen, all 43 expect `partial`, and all 43 pass. The rule is broken one layer
earlier: **the extraction model manufactures the specimen**, and by the time the
resolver sees the row the axis looks stated.

Measured on document `f0a8d0c2-d950-4463-a5b8-b685a5f8c6a2`
(`sample_lab_report_english_mock.pdf`, 44 current rows):

```
specimen: {"serum": 16, "whole_blood": 28}    -> concrete on 44/44 rows
method  : {"null": 44}                         -> null on 44/44 rows

"serum" / "plasma" / "whole blood" in the raw PDF bytes: absent
result table columns: Test | Result | Unit | Reference range | Instrument
```

Not one of the 44 rows has a specimen its own `source_text` states. The
asymmetry against `method` is the tell: EH-113 added an explicit "do not infer"
instruction for `method` and it holds at 44/44 null. `specimen` never got one.

Consequences today: the document resolves `27 resolved / 17 partial`, and
`Glucose` resolves to `glucose_serum` — a key listed under
`approvals.scoreAffectingBindingOwners` in
`registry/candidate-release/v1/policy.json` precisely because it feeds Health
Profile assessment. A model guess is currently sufficient to select it, and the
reviewer sees **Matched measurement** with no indication that the specimen was
never in the document.

ADR 0001 rejected exactly this: *"Synthetic `biomarker_key` or guessed specimen —
turns unreviewed strings into durable medical identity."* The apparatus built to
prevent it all sits around the resolver, while the guess enters upstream of it.

## What Changes

- Define **stated** axis evidence: an axis value is stated only when its lexical
  form occurs in the provenance the extraction already captured for that row —
  its `source_text` or its `section_context`. Anything else is an inference.
- **BREAKING (outcome-changing):** the resolver input projection
  (`measurementInputFromExtracted`) drops any concrete `specimen`, `modifier`,
  `method` or timing value that is not stated. Unstated axes are reported as
  missing, so they can no longer clear `missingAxes` and can no longer unlock
  `resolved`.
- Add the missing extraction-prompt instruction for `specimen`, mirroring the
  existing `method` rule, so the database stops accumulating fabricated axes.
- Apply the same filter in the extraction parser at write time, so the stored row
  reflects what the document says rather than what the model believes.
- Add a static gate: no current extracted row may carry a concrete axis value
  absent from its own captured provenance. This is the check that would have
  caught the defect at upload time.
- Extend the candidate corpus to exercise the **extraction seam**, not only the
  resolver, so a fabricated axis cannot pass every threshold again.
- Record discarded inferences in a non-authoritative column so the frequency of
  model guessing is measurable, and a future reviewed per-panel specimen policy
  has data to be designed against. Separable from the safety fix; ordered after
  it.
- Bump `MEASUREMENT_NORMALIZATION_VERSION` `5` → `6` (the input projection
  changed) and the extraction `processing_version`.

Deliberately unchanged: resolver scoring, the compatibility axes themselves, the
measurement catalog, the acceptance/correction writer, and verification
transitions.

## Capabilities

### New Capabilities

None. This restores an existing requirement that is currently violated.

### Modified Capabilities

- `extraction-provenance`: provenance fields must record what the document
  states; an axis value not evidenced in captured provenance is not stored or
  forwarded as stated.
- `document-type-extraction`: the lab extraction prompt must forbid inferring
  specimen, as it already forbids inferring method.
- `analyte-measurement-model`: the "unknown must not behave as positive
  evidence" rule is enforced at the resolver **input boundary**, not only inside
  the resolver.
- `registry-release-corpus-governance`: candidate evidence must cover the
  extraction-to-resolver seam, and axis provenance must be gated before release.

## Impact

- Affected domains: documents (extraction), health-profile (measurement
  resolution and anything downstream of it).
- Affected code: `src/lib/documents/extraction.ts` (prompt + parser),
  `src/lib/biomarkers/qualitative.ts` (`inferSpecimen` explicit pass-through),
  `src/lib/documents/normalization-review.ts`
  (`measurementInputFromExtracted`), `src/lib/biomarkers/measurement-resolution.ts`
  (`MEASUREMENT_NORMALIZATION_VERSION`), new verification script, `package.json`.
- Affected data: no schema change is required for the safety fix. Existing rows
  are corrected at read time, because EH-116 reprocessing re-runs the **resolver**
  and not the extractor, so a write-time-only fix would leave every stored row
  fabricated. The optional observability column is one additive nullable
  `jsonb`, no constraint change and no backfill.
- Affected release governance: `candidateInputHash` covers
  `normalizationVersion`, so the seven approvals in
  `registry/candidate-release/v1/approvals.json` are invalidated again. #105
  invalidates them for the same reason, so both changes should ship as a single
  `registry-v2.0.0-candidate.2` rather than repeating the procedure twice.
- Expected user-visible movement: up to 27 rows on the sample document move from
  **Matched measurement** to **More details needed**, and Health Profile loses
  those inputs. This is the correct direction — those rows were never entitled to
  a concrete identity — and must be communicated as such, not as a regression.
