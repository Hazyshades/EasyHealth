## Why

Printed detection-limit results such as `< 0.20` are currently stripped to a bare number (`0.2`) and can land on the `modifier` clinical axis as `<` or `less than`. That invented magnitude then displays as exact, receives Normal/Attention/Low, plots on trends, and can satisfy Health Profile numeric readiness. EH-164 is P0 clinical safety and must land before EH-165; EH-119 already refuses to make this worse on correction and deferred the storage model here (#108 / #183).

## What Changes

- Treat a leading comparator plus number as `value_kind = text` with verbatim `value_text` and `value = null`. Keep dipstick ordinals (`2+`) ahead of this branch.
- Stop `parseLabNumber` from rescuing comparator cells on the extraction value path. Reference-range bound parsing MAY still read a numeric bound from `< 5`.
- Extraction prompt: comparators belong on `value`, never on `modifier`. Coerce punctuation/comparator modifiers to `none`.
- Acceptance and EH-119 correction prefer printed comparator text over a synthesised `value_numeric`. Restating `< 0.20` stays text.
- Biomarkers status chip: `Threshold result`. Comparison helper excludes the row from numeric series.
- Health Profile admission treats the row as unusable text even if a stale numeric is still present.
- Add `scripts/verify-eh164-censored-results.ts`, `pnpm test:eh164` on the verify job, a read-only audit query (no UPDATE), QA checklist, and Registry documentation sync for the persistence/readiness contract.
- **Not BREAKING** for schema: no `value_relation` / `threshold_value` columns. Already-accepted corrupted rows are not silently rewritten.

## Capabilities

### New Capabilities

- `censored-lab-results`: Preserve printed comparator/threshold laboratory values as text through extraction, acceptance, correction, Biomarkers, trends, and Health Profile admission; keep comparators off the modifier axis.

### Modified Capabilities

- `health-profile-score-readiness`: A censored/threshold result is not a usable finite numeric alternative.

## Domain

`documents` (extraction, staging, correction) and `health-profile` (Biomarkers table, comparison series, assessment admission).
