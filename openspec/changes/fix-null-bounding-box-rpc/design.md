## Context

The documents acceptance route fetches an extracted biomarker and sends it through `writeExtractedBiomarkerNormalization`. The application writer validates `row.bounding_box` with `parseSourceRegion`, then deliberately emits `bounding_box: null` when a region is unavailable or does not match `source_page`; this is the supported page-only provenance fallback.

The active normalization RPC is layered: the public thirteen-argument writer wrapper forwards to the EH-119 fourteen-argument delegate, and that delegate inserts the initial `observations` row. The delegate currently inserts `p_observation -> 'bounding_box'` unchanged. PostgreSQL distinguishes SQL `NULL` (absent value) from JSONB `null`; the latter is non-null for the `observations_source_region_valid` CHECK and fails `eh118_is_source_region`.

The fix must preserve the EH-115 decision-trace wrapper, EH-119 measurement override path, write-once provenance policy, and strict EH-118 region contract. A migration is required because the RPC body is deployed database code.

## Goals / Non-Goals

**Goals:**

- Make omitted and explicit JSON `null` source regions persist as SQL `NULL`.
- Keep valid normalized region objects unchanged and subject to the existing page/geometry CHECK constraint.
- Keep invalid non-null objects and unsupported JSON shapes rejected rather than silently accepting them.
- Exercise the exact TypeScript writer payload shape at the database seam.
- Prove that a page-only acceptance creates one observation with its source page and no region.

**Non-Goals:**

- Do not weaken, remove, or bypass `observations_source_region_valid`.
- Do not fabricate a page or region when extraction lacks provenance.
- Do not change `parseSourceRegion`, OCR extraction, region rendering, resolver identity, or acceptance status semantics.
- Do not add a client-side workaround that merely omits the nullable field; the RPC remains the authoritative boundary for all callers.
- Do not commit repository changes as part of delivery.

## Decisions

### 1. Normalize JSON null in the deployed RPC boundary

Recreate the current fourteen-argument `write_observation_normalization_revision_v2_legacy` delegate in a new ordered migration, changing only the observation insert expression to normalize the region value:

```sql
nullif(p_observation -> 'bounding_box', 'null'::jsonb)
```

An absent key already yields SQL `NULL`; JSONB `null` is converted to SQL `NULL`; any non-null object, array, or scalar is passed through unchanged. Therefore a valid object still reaches the database contract, while a malformed non-null value still fails the existing CHECK. Keep the thirteen-argument compatibility wrapper and service-role grants unchanged, forwarding through the recreated delegate exactly as migration 047 does.

This is preferred over changing TypeScript to omit the key because the RPC is called by multiple flows and must normalize payloads consistently. It is preferred over weakening the constraint because JSONB `null` is not a source region and must not become a permitted stored shape.

### 2. Extend the writer seam fixture with an explicit null

Update `supabase/tests/writer_rpc_seam.sql` so its observation JSON includes `bounding_box: null`, matching `buildObservationPayload` for a page-only row. Keep the existing acceptance assertion and add an assertion that the created observation has `source_page = 1` and `bounding_box IS NULL`. The test must fail against the pre-fix delegate and pass against the new migration.

Retain the existing EH-118 database tests for malformed objects and page mismatches; they continue to prove that the strict constraint was not relaxed.

### 3. Treat the migration as a clean ordered replacement

The migration must target the currently active fourteen-argument delegate, not replace the public EH-115 wrapper or remove the EH-119 overload. The function body should be based on the current migration 047 implementation, preserving all existing validation, identity gates, measurement override projection, CAS, idempotency, and trace checks. The only behavioral delta is JSON-null normalization at the observation insert.

### 4. Verify production behavior without a repository commit

Run the seam and relevant database suites locally where available, then apply the new migration to the target Supabase project through the approved deployment path. Accept the previously failing page-only row or an equivalent safe fixture and verify the observation is present with `source_page` and SQL-null `bounding_box`. Create the requested GitHub issue with the reproduction/evidence, then close it only after the fix and deployment evidence are recorded.

## Risks / Trade-offs

- **Risk:** Recopying the large delegate can drift from migration 047. → **Mitigation:** copy the current fourteen-argument body exactly, make one isolated expression change, preserve the thirteen-argument wrapper, and run the existing writer seam plus EH-119 suites.
- **Risk:** `nullif` could accidentally hide malformed values. → **Mitigation:** compare only against JSONB `null`; pass arrays, strings, and invalid objects through so the existing CHECK rejects them.
- **Risk:** The application and database migrations may be deployed out of order. → **Mitigation:** the application already emits nullable page-only payloads; deploy the migration before relying on acceptance in the target environment and record the migration version in the issue.
- **Risk:** Retrying the real user row may create an unintended duplicate or modify production data. → **Mitigation:** use the existing source-row idempotency contract and a safe equivalent fixture unless the target owner explicitly authorizes the real-row retry.

## Migration Plan

1. Add the next ordered Supabase migration recreating the active fourteen-argument normalization delegate with `NULLIF(..., 'null'::jsonb)` for `bounding_box`.
2. Preserve the public wrapper, permissions, and `notify pgrst` behavior from the current function migration.
3. Add the explicit-null writer seam assertion and run the database suites that cover writer acceptance, EH-118 provenance, EH-119 correction, and Registry 2.0 acceptance.
4. Deploy the migration to the target Supabase project.
5. Verify one page-only acceptance reaches `observations` with `source_page` set and `bounding_box IS NULL`; verify malformed populated regions still fail.
6. If rollback is required, restore the previous delegate body only after stopping acceptance traffic; the rollback intentionally restores the old failure for explicit JSON null and therefore is not a safe steady state.

## Open Questions

- Which target Supabase project/environment should receive the migration and which safe fixture should be used for the post-deployment acceptance evidence?
- Should the GitHub issue be linked to an existing roadmap issue, or created as a standalone bug issue?
