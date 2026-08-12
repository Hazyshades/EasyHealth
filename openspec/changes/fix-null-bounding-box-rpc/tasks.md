## 1. Reproduce and lock the seam

- [x] 1.1 Update `supabase/tests/writer_rpc_seam.sql` so the observation fixture includes an explicit JSON `bounding_box: null`, matching the page-only payload built by the TypeScript writer.
- [x] 1.2 Assert that the seam acceptance creates exactly one linked observation with the expected `source_page` and SQL `bounding_box IS NULL`.
- [x] 1.3 Keep or add a seam assertion for a malformed non-null region so the regression suite proves invalid populated provenance is still rejected.

## 2. Fix the deployed RPC boundary

- [x] 2.1 Add the next ordered Supabase migration recreating the current fourteen-argument `write_observation_normalization_revision_v2_legacy` delegate from migration 047.
- [x] 2.2 Change only the observation insert expression to convert absent/JSON-null `bounding_box` to SQL `NULL` with `NULLIF`, while passing every non-null value through the existing EH-118 CHECK contract.
- [x] 2.3 Preserve the EH-115 thirteen-argument wrapper, EH-119 measurement override path, CAS/idempotency logic, trace validation, service-role permissions, and PostgREST reload behavior.

## 3. Verify repository behavior

- [x] 3.1 Run the writer RPC seam suite and confirm it fails against the pre-fix behavior and passes with the migration applied.
- [x] 3.2 Run the EH-118 provenance, EH-119 correction, Registry 2.0 acceptance, and related database suites; confirm malformed regions and page mismatches remain rejected.
- [x] 3.3 Run the relevant TypeScript checks/build and confirm no application payload contract or registry hash changes are introduced.

## 4. Deploy and record evidence

- [x] 4.1 Apply the migration to the authorized target Supabase project and verify the deployed function signature/body is the fixed delegate.
- [x] 4.2 Accept one safe page-only extracted fixture and verify the observation, source page, SQL-null region, active revision, and no half-linked records.
- [x] 4.3 Create the requested GitHub bug issue with the original error, affected path, migration identifier, and verification evidence.
- [x] 4.4 Close the GitHub issue only after deployment and acceptance evidence are recorded; leave all repository changes uncommitted.
