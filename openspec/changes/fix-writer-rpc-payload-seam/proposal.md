## Why

Accepting an extracted biomarker has never worked. Every row failed with
`invalid_normalization_resolution_payload`, the API reported only "Normalization
writer failed", and the database holds zero observations against 746 current
extracted rows. The product's core loop — upload, review, accept, profile — has
never completed once.

The promotion primitive required `resolver_evidence` to be a JSON array, a rule
inherited from migration `021` when the column held a flat evidence list. Since
EH-106 the writer sends the v2 `ResolverDecisionTrace` object. The read path
agrees with the writer; only the validation was stale.

Nothing caught it. The pgTAP fixture hand-builds a valid array; the writer test
substitutes the database. Neither crosses the seam where the two contracts meet.

## What Changes

- Migration `045` recreates `write_observation_normalization_revision_v2_legacy`
  accepting the v2 trace object, still tolerating the legacy array. It targets
  the delegate, not the EH-115 wrapper that fronts it.
- `failureMessage` reports the message from a non-`Error` rejection instead of
  replacing it with a placeholder, and the correction route reuses it.
- `supabase/tests/writer_rpc_seam.sql` submits the exact payload shape
  `buildNormalizationResolutionPayload` produces, and runs in CI.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `registry-v2-acceptance-correction`: the writer's own payload must be
  exercised against the deployed primitive, and a non-`Error` database rejection
  must reach the caller.

## Impact

`supabase/migrations/045_writer_rpc_resolver_evidence_shape.sql`,
`supabase/tests/writer_rpc_seam.sql`,
`src/lib/documents/biomarker-acceptance-batch.ts`,
`src/app/api/documents/[id]/biomarkers/route.ts`,
`.github/workflows/measurement-registry.yml`, `package.json`.

**Deployment:** migration `045` must be applied before the fix takes effect.
Until then acceptance keeps failing.
