# Tasks: the writer's payload must reach its own primitive

## 1. Reproduce

- [x] 1.1 Add `supabase/tests/writer_rpc_seam.sql` submitting the exact payload
      the TypeScript writer builds. Confirmed failing with
      `invalid_normalization_resolution_payload` before the migration.
- [x] 1.2 Wire `test:writer-seam`.

## 2. Fix

- [x] 2.1 Migration `045` widening the evidence check to accept the v2 trace
      object while tolerating the legacy array. Targets
      `write_observation_normalization_revision_v2_legacy` — EH-115 renamed the
      EH-106 function and fronted it with a trace validator, so replacing the
      wrapper would revert EH-115. Caught by `test:eh106-db` and `test:eh115-db`
      failing on the first attempt.
- [x] 2.2 `failureMessage` surfaces a non-`Error` rejection; the correction route
      reuses it instead of its own inline check.

## 3. Verify

- [x] 3.1 Seam fixture passes with the migration and fails without it.
- [x] 3.2 All thirteen database suites pass.
- [x] 3.3 Full TypeScript sweep and build pass; candidate hash unchanged.
- [x] 3.4 Wire `test:writer-seam` into the CI database job.

## 4. Deliver

- [x] 4.1 Spec delta requiring the seam to be exercised.
- [ ] 4.2 Apply migration `045` to the target database, then accept one row and
      confirm it reaches Health Profile. This cannot be verified from the
      repository.
