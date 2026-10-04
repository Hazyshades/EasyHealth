# Design: eh-104-sql-lint-cleanup

## Context

The current migration chain contains EH-104 database functions created by migrations 031, 079, and 082. The final schema intentionally removes `public.measurement_resolution_shadow_events` in migration 026, but the later resolver preflight still contains a dynamic compatibility query for that retired relation. The function is safe at runtime when the relation is absent because it checks `to_regclass` first, but repository-wide database lint still reports the textual relation reference.

The durable upload-ticket and Health Profile synthesis functions contain genuine PL/pgSQL name collisions. `consume_storage_upload_ticket` returns an output column named `intent_id`, which conflicts with the unqualified upload-ticket table column. `persist_profile_health_synthesis` returns output columns named `profile_id` and `input_hash`, which conflict with the corresponding unqualified table columns in its lookup query. These are schema-definition defects in the EH-104 boundary, not EH-151 behavior.

The change must preserve already-applied migration history, existing RPC signatures, fixed search paths, `SECURITY DEFINER` behavior, service-only grants, error codes, lock ordering, and return shapes. Migration filenames are serialized integration points in this repository, so the final migration number must be selected from the integration branch rather than guessed in this design.

## Goals / Non-Goals

**Goals:**

- Make the final migrated public schema free of the three reported EH-104 lint findings.
- Remove the obsolete shadow-table compatibility branch without restoring the retired table.
- Make all affected table references explicit where PL/pgSQL output parameters can shadow column names.
- Preserve the behavior and authorization boundary of the upload-ticket and synthesis RPCs.
- Provide focused database evidence that the current-schema preflight and corrected writer definitions execute successfully.
- Record the resolver-preflight contract and complete the required Registry documentation synchronization checks without inventing catalog behavior.

**Non-Goals:**

- No EH-151 share-link implementation or public-route change.
- No Mistral package, worker dependency, or TypeScript source change.
- No Next.js environment or browser-smoke setup change.
- No trusted-ingress deployment or EH-154 release-gate evidence.
- No restoration, backfill, or compatibility support for `measurement_resolution_shadow_events`.
- No change to report, synthesis, upload, resolver, observation, or Health Profile product semantics.

## Decisions

### 1. Use a forward corrective migration

Add one maintenance migration after the current EH-104 migration chain. It will use `CREATE OR REPLACE FUNCTION` for the three affected function definitions, retaining the existing signatures and grants. Historical migrations 031, 079, and 082 are not rewritten after they may have been applied to shared environments.

A direct edit of old migration files is acceptable only before any target has applied them. The default implementation path is the forward migration because it keeps migration history reproducible for existing targets and makes the fix deployable to both fresh and already-migrated databases.

The migration must repeat the complete canonical function bodies where PostgreSQL requires a full function replacement. Only the retired branch removal and identifier qualification may differ from the existing definitions.

### 2. Remove, rather than disguise, the retired shadow query

The `measurement_resolution_shadow_events` branch is removed from `eh104_resolution_verification_preflight`. The current migration chain already drops the table before the preflight function is created, and no active caller or current test treats the retired relation as an authority.

Recreating the table, adding a compatibility view, or obfuscating the relation name inside another dynamic query would preserve dead schema weight and leave the migration contract misleading. Historical installations that need legacy-data inspection must use a pre-cutover operational procedure, not a current runtime preflight dependency.

### 3. Qualify conflicting identifiers at the table boundary

The upload-ticket lookup uses an explicit alias such as `upload_ticket.intent_id` and `upload_ticket.ticket_hash`. The corresponding lookup in `complete_storage_write_intent` uses the same explicit alias for consistency, even though it does not expose the same output-parameter collision.

The synthesis lookup uses an explicit alias such as `synthesis.profile_id` and `synthesis.input_hash`. Qualifying both fields prevents the next ambiguity from being exposed after the first one is fixed and keeps the intended comparison between table columns and `p_*` parameters obvious.

Input parameter names, output column names, function overloads, and RPC call sites remain unchanged. Renaming parameters or dropping/recreating functions is rejected because it increases compatibility and grant risk without solving a deeper problem.

### 4. Verify through the migrated database boundary

The primary proof is the final schema, not source-text inspection alone:

1. Apply the complete migration chain to a disposable local Supabase database.
2. Run `supabase db lint --local` and require no EH-104 relation or ambiguity findings.
3. Run the existing `pnpm test:eh104-db` and `pnpm test:eh104-durable-deletion-db` suites.
4. Add focused assertions for preflight execution with the retired relation absent, service-only RPC grants, and the upload-ticket/synthesis function signatures.
5. Exercise the existing synthetic writer/deletion fixtures where they already cover the corrected functions; do not create tests that merely assert source formatting.

The worker typecheck, browser smoke, and platform ingress checks remain separate evidence streams and are not used to close this change.

### 5. Treat Registry synchronization as an intentional no-catalog-change gate

The change touches the resolver verification migration and therefore follows the repository's Registry documentation synchronization rule. The implementation must confirm that canonical biomarker/catalog/alias/corpus documentation is unchanged, run the required generator, drift, and documentation tests, render the Wiki staging output, and create or update one tracking issue recording the no-catalog-behavior delta and any unavailable remote publication step.

No generated catalog page or Wiki inventory is hand-edited. The tracking record must not claim new resolver behavior; it records only removal of a retired preflight dependency and the database verification evidence.

## Risks / Trade-offs

- **[Forward migration duplicates existing PL/pgSQL bodies]** → Keep the replacement bodies byte-for-byte equivalent except for the explicitly scoped branch/qualification changes, review grants and signatures, and run the migrated database suites.
- **[A migration number collides with EH-151 or another branch]** → Select the next available filename during serialized integration; never reserve a guessed number in this proposal.
- **[A target has a divergent function definition]** → Use the canonical current migration body as the replacement source and verify the target's migration history before deployment; use another forward correction if drift is discovered.
- **[Removing compatibility hides data on an unsupported legacy schema]** → Treat the retired table as unsupported after migration 026 and run any legacy inspection before cutover, not through the current preflight.
- **[Local lint is unavailable because Postgres is not running]** → Record the command as blocked and require CI or a disposable Supabase target; do not mark the schema clean from static inspection.
- **[Registry documentation operations are unavailable remotely]** → Complete local canonical generation and staging, then record Wiki/issue status as `PENDING` or `BLOCKED` with exact handoff evidence.

## Migration Plan

1. Confirm the target migration history and choose the next free migration filename during integration.
2. Add the forward function-replacement migration with the retired preflight branch removed and table identifiers qualified.
3. Reapply grants, `SECURITY DEFINER`, `SET search_path`, and schema reload behavior exactly as required by the existing definitions.
4. Extend the focused EH-104 database evidence without changing unrelated fixtures.
5. Reset a disposable local Supabase database and run the SQL lint and EH-104 database suites.
6. Run the required Registry documentation generation, drift, documentation-test, Wiki-render, and local-staging checks; update one tracking issue with canonical-doc and Wiki status.
7. Deploy the migration to the reviewed target only after local/CI evidence is green and migration history is confirmed.
8. If a defect is found after deployment, roll forward with another `CREATE OR REPLACE FUNCTION` migration. Do not manually drop functions or edit applied migration files as rollback.

## Open Questions

- Which migration number is available at implementation time after the active EH-151 migration is integrated?
- Is there any already-applied target whose function definitions diverge from migrations 031, 079, or 082 and therefore needs a pre-deployment drift report?
- Which operator owns the Registry tracking issue and Wiki publication handoff if remote GitHub/Wiki access is unavailable during verification?
