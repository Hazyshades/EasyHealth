## Why

Acceptance of an extracted laboratory result can fail even when the result has a valid source page and no source region to store. The TypeScript writer sends an explicit JSON `bounding_box: null`, but the normalization RPC passes JSONB null directly into `observations`, where `observations_source_region_valid` treats it as a non-null invalid region; this blocks the core review-to-Health-Profile flow and leaves the row unaccepted.

## What Changes

- Normalize an absent or JSON-null `bounding_box` to SQL `NULL` at the normalization RPC boundary before inserting an observation.
- Preserve strict validation for populated source-region objects; invalid geometry, page mismatches, and unsupported shapes remain rejected by the database contract.
- Add a database seam regression case using the exact writer payload shape with an explicit `bounding_box: null` and assert that the observation is created with page-only provenance.
- Verify the acceptance path reports success for a page-only extracted row and does not create a half-linked record on genuine provenance violations.
- Record the fix in a GitHub issue and close it only after implementation verification; do not create a commit as part of this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `registry-v2-acceptance-correction`: acceptance of a document-sourced result with a valid source page and no source region must create the observation with SQL-null region provenance, while malformed populated regions remain rejected.

## Impact

- **Domain:** documents / extraction provenance and Registry 2.0 acceptance.
- **Database:** a new migration recreates the active normalization writer delegate or otherwise changes its JSON-to-JSONB insertion expression without weakening `observations_source_region_valid`.
- **Tests:** `supabase/tests/writer_rpc_seam.sql` and the relevant database verification job gain an explicit-null provenance case.
- **Runtime:** `src/lib/documents/observation-normalization-writer.ts` remains the source of the page-only payload; the RPC becomes tolerant of its explicit nullable field.
- **Operations:** the target Supabase project must receive the migration before production acceptance is expected to work.
