# Proposal: eh-104-sql-lint-cleanup

Domain: **documents / health-profile / reports**

## Why

Repository-wide `supabase db lint --local` still reports three EH-104 database-definition issues. One is a dead compatibility branch that references the retired `measurement_resolution_shadow_events` table; two are real PL/pgSQL identifier ambiguities in the durable upload-ticket and Health Profile synthesis writers. The issues are outside EH-151, but they make the shared schema verification noisy and can fail or defer validation of the durable deletion prerequisite.

A focused corrective change is needed now to make the final EH-104 schema lint-clean without restoring retired storage or changing the public EH-151 capability boundary.

## What Changes

- Add one EH-104 maintenance migration that replaces the affected function definitions while preserving applied migration history.
- Remove the obsolete shadow-table compatibility query from `eh104_resolution_verification_preflight`; do not recreate or retain the retired table.
- Qualify the upload-ticket table alias in `consume_storage_upload_ticket` and its corresponding ticket lookup in `complete_storage_write_intent`.
- Qualify the `profile_health_synthesis` table alias, including both `profile_id` and `input_hash`, inside `persist_profile_health_synthesis`.
- Preserve existing function signatures, service-only grants, fixed `search_path` declarations, transaction behavior, error codes, and RPC return shapes.
- Add focused database evidence for the corrected preflight, upload-ticket transition, and synthesis writer definitions.
- Verify the fully migrated local schema with `supabase db lint --local` and the existing EH-104 durable-deletion database suite.
- Keep Mistral dependency installation, browser runtime environment, trusted-ingress deployment review, EH-151, and EH-154 release evidence out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `observation-resolution-verification`: require the populated-data preflight to depend only on relations that remain in the current migration chain; the retired shadow telemetry table is not a supported runtime dependency.

The upload-ticket and synthesis corrections preserve existing RPC behavior and are implementation-level fixes covered by verification tasks, not new product requirements.

## Impact

Affected areas are the Supabase migration chain and EH-104 database verification. The change touches the durable document upload broker, the Health Profile synthesis writer, and the historical resolver preflight definition. Existing application callers continue using the same RPC names and argument lists. No worker package, Next.js runtime environment, public share route, ingress configuration, or token behavior changes.
