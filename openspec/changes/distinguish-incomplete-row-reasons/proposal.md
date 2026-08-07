## Why

Every incomplete laboratory row tells the reviewer the same thing — *"The result is
recognized, but required context is missing"* — no matter why it is incomplete. On a real
44-row upload (`298232ee`), that one sentence covers four different situations, and for
twelve of them it is **false**: those rows are blocked only because their measurement
definition is still `provisional`, so no context exists that the reviewer could supply and
nothing they do will move the row. The screen sends a clinician looking for a detail that
does not exist.

| actual reason | rows | can the reviewer act? |
| --- | ---: | --- |
| specimen not stated by the document | 26 | only by uploading a report that prints it |
| definition maturity is `provisional` | 12 | **no — this is ours to fix** |
| method not stated (CBC differentials) | 5 | only if the report states it |
| specimen + modifier + timing + method | 1 | partly |

The cause is mechanical, not editorial. `resolveMeasurementDefinition` decides
admissibility with a single boolean AND
(`measurement-resolution.ts:860-870`) whose conjuncts include
`definition.maturity === "reviewed"`. When maturity is the only failing conjunct, **nothing
is recorded**: `missingAxes`, `conflicts`, `rejected` and `supportCodes` are all empty, and
`measurementMappingGuidance` is keyed on the outcome alone, so the row is
indistinguishable from a genuinely under-specified one. The header counter inherits the
same flaw: `44 incomplete` merges twelve rows we owe the user with thirty-two the document
owes.

## What Changes

- Capture **why** a candidate failed admissibility instead of discarding it. The
  `admissible` filter gains explicit rejection reasons for each conjunct it already
  evaluates — maturity, source provenance, alias authority, alias approval, missing axes
  and the score floor — so the cause survives into evidence rather than being inferred
  downstream.
- Add an **incomplete reason class** projected onto every non-`resolved` row, derived from
  that captured evidence: at minimum `axis_not_stated`, `definition_not_reviewed` and
  `unit_or_value_conflict`. The four-outcome enum is unchanged; this is an additional
  field, never a fifth outcome.
- Carry the reason class through `LaboratoryResolutionDetails` and the normalization
  review payload, so it is available for rows that have **no active revision**. Today
  maturity survives only in the persisted decision trace, which preview rows do not have —
  the exact moment the reviewer reads the copy.
- Give each reason class its own guidance. `definition_not_reviewed` must state plainly
  that the wait is on catalog review, not on the reader, and must not invite them to
  supply anything.
- **Name the specific missing axis at row level** — "The specimen is not stated in this
  report" rather than "required context is missing" — without expanding technical details.
  This closes issue #63, whose remaining acceptance criterion is the same defect.
- Split the header counters so "waiting on the document" is distinct from "waiting on
  catalog review".
- Extend `REASON_LABELS`, which today has seven entries, a dead `unit_conflict` key that is
  not a real reason code, and no entry for `modifier`, `timing` or `method` — those fall
  through to raw underscore-replacement and reach the reviewer as machine tokens.

**Not in scope:** reviewing the eight provisional definitions that block those twelve rows.
That is a catalog decision with its own approval and hash, and it is tracked separately —
this change makes the state legible, it does not change which definitions are reviewed.

## Capabilities

### New Capabilities
- `incomplete-outcome-reason-class`: the taxonomy of reasons a recognized row did not
  resolve, how each is derived from resolver evidence, how it is serialized, and the rule
  that a reason the reviewer cannot act on must never be presented as one they can.

### Modified Capabilities
- `context-aware-measurement-resolution`: admissibility rejection becomes attributable —
  the resolver records which conjunct excluded a candidate instead of returning a bare
  boolean.
- `analyte-measurement-model`: definition maturity becomes observable in the decision
  trace, so a provisional-blocked row can be told apart from an under-specified one.
- `incomplete-laboratory-outcomes`: the serialized outcome carries the reason class;
  guidance wording becomes reason-specific rather than one sentence per outcome; the
  missing axis is named at row level.
- `document-extraction-review`: review copy distinguishes what the document owes from what
  the catalog owes.
- `observation-review-workspace`: the header counters separate the two.

## Impact

**Prerequisite.** The EH-117 and EH-118 changes are implemented and merged (27/27 and
32/32) but **not archived**, so `openspec/specs/observation-review-workspace/` does not yet
exist and three requirements this change modifies already carry pending EH-117 deltas.
Both must be archived before these deltas are written, or EH-117's additions will be
silently reverted.

**Code.** `src/lib/biomarkers/measurement-resolution.ts` (admissibility, trace builder),
`src/lib/biomarkers/types.ts` (reason-code union, candidate evidence, persisted trace),
`src/lib/documents/incomplete-laboratory-outcomes.ts` (projection, metric),
`src/lib/documents/normalization-review.ts` (review payload),
`src/lib/documents/biomarker-review-state.ts` (copy),
`src/lib/documents/observation-review-workspace.ts` (row projection, counters),
`src/components/documents/review/*` (row rendering).

**Tests that pin strings this change alters**, none of which run in CI today (issue #110):
`verify-eh112-incomplete-outcomes.ts` L249-251 and the exact metric key set at L213-227;
`verify-document-review-runner.ts` L11-12; `verify-eh117-review-workspace.ts` L176, L230,
L440, L450. Widening `measurementMappingGuidance` is an arity change, so all four call
sites break at compile time — which is the desired failure mode.

**Dead code to remove.** `LaboratoryConsumerExclusionReason` already declares
`"unreviewed_definition"`, and it is never produced: `baseExclusion` short-circuits every
non-resolved outcome to `"incomplete_resolution"` first. Either it becomes real here or it
goes.
