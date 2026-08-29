# Reviewed panel specimen policy

## Why

#106 stops the extraction model from passing off an invented specimen as
something the document stated. That is correct, and it is also expensive: on
`sample_lab_report_english_mock.pdf` the document goes from `27 resolved /
17 partial` to `0 resolved / 44 partial`. No laboratory result from that
document reaches Health Profile at all.

The information is not actually missing. The report prints its own section
headings:

```
Biochemistry and inflammation
Complete blood count with manual smear microscopy + ESR
```

A clinician reading `Complete blood count` knows the specimen is whole blood.
The system still cannot use that knowledge. As of 2026-08-28 the heading is
already transcribed into `section_context` and `document_pages.ocr_text` is
stored for every page — but a heading is not a specimen word, so #106 still
leaves the axis missing. The link is medical knowledge, not text.

That knowledge has to live somewhere. Today it lives inside an extraction model,
re-derived silently for every row, differently on every run, invisible in the
result. This change moves it to the only place it can be checked: a reviewed,
versioned entry in the measurement catalog, approved once by a named owner and
recorded in the decision trace whenever it applies.

The reviewer-facing consequence is deliberately nil. The person reviewing a
document is never asked which specimen applies — `document-extraction-review`
already forbids that, and after #106 the manual mapping control does not even
render for these rows. One approved rule replaces forty-four invisible guesses.

## What Changes

- Keep the existing `section_context` transcription path. Ground a stored
  heading against that row's page `ocr_text` so a fabricated heading cannot
  unlock a policy. Transcription is checkable against page text; inference is
  not.
- Introduce `PanelSpecimenPolicy` as a first-class catalog entity in TypeScript,
  therefore inside the release manifest, therefore covered by the manifest digest
  and by the approval hash.
- Ship exactly one policy at launch: a complete-blood-count heading implies
  `whole_blood`. It is narrowed to an explicit analyte allowlist of the 18 CBC
  constituents, covering 30 reviewed definitions.
- **Exclude `glucose` and `hba1c` explicitly.** Both have reviewed
  `whole_blood` definitions and both are score-affecting, so an unnarrowed
  policy would let a mis-sectioned glucose row select `glucose_whole_blood` on
  the strength of a heading. Precisely the class of defect #106 exists to stop.
- Give a policy-derived specimen its own evidence code
  `specimen_from_reviewed_panel`, with a lower weight than a printed specimen, so
  the decision trace always says which one applied and a panel heading alone
  cannot push a marginal candidate over the bar.
- Extend `MeasurementResolutionInput` with the provenance of the specimen
  (`stated` versus `reviewed_panel_policy`) so the resolver can tell them apart
  rather than receiving an indistinguishable string.
- Add the approval scope for panel policies. Seven score-affecting CBC keys
  require `assessment-owner` sign-off: `hemoglobin_whole_blood`,
  `hematocrit_whole_blood`, `rbc_whole_blood`, `wbc_whole_blood`,
  `platelets_whole_blood`, `rdw_cv`, `rdw_sd`.
- Add corpus coverage for the panel path, including the negative case: a
  chemistry analyte printed under a CBC heading must not inherit whole blood.

Explicitly not in this change: a `Biochemistry ⇒ serum` policy (a biochemistry
panel may be serum or plasma, so the implication is not safe), LLM citation of
specimen locations, and any change to what a document reviewer is asked to do.

## Capabilities

### New Capabilities

- `panel-specimen-policy`: reviewed, versioned catalog rules that let a printed
  panel heading supply a specimen, with their own evidence code, analyte
  narrowing, approval scope and collision rules.

### Modified Capabilities

- `extraction-provenance`: the section heading becomes captured provenance and
  must be a verbatim transcription rather than a summary or inference.
- `document-type-extraction`: the lab extraction prompt must transcribe the
  heading a row is printed under.
- `context-aware-measurement-resolution`: the specimen axis may be satisfied by a
  reviewed panel policy, recorded distinctly from a stated specimen.
- `resolver-decision-trace`: the persisted trace admits and must record
  `specimen_from_reviewed_panel`.
- `registry-release-corpus-governance`: panel policies are a new approval scope
  and require their own corpus coverage.

## Impact

- Affected domains: documents (extraction), health-profile (resolution and
  everything downstream).
- Affected code: `src/lib/documents/extraction.ts`, `worker/src/pipeline.ts`,
  a new panel-policy module under `src/lib/biomarkers/`,
  `measurement-resolution.ts` (specimen evaluation, evidence table, trace codes),
  `measurement-registry-release.ts` (manifest must cover policies),
  `stated-axis-evidence.ts` (policy-derived specimen must survive the #106
  filter), `registry/candidate-release/v1/policy.json`, and a migration widening
  the EH-115 trace allowlist.
- **Existing documents are not fixed by this change alone.** #106 corrects stored
  rows on read because reprocessing re-runs resolution. This change depends on
  `section_context`, which is `null` on every stored row, and EH-116 reprocessing
  does not re-run extraction. Existing documents need re-extraction, or the
  optional deterministic backfill described in the design.
- Affected governance: the manifest digest changes because the catalog gains
  policy entries, so this invalidates the approval hash exactly as #105 and #106
  do. All three should land in one `registry-v2.0.0-candidate.2`.
- Expected movement on the sample document: 27 CBC rows regain concrete identity; the 28th printed CBC-heading row is ESR and stays `partial`;
  the 16 biochemistry rows stay `partial`, which is the intended outcome.
