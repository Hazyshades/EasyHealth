## 1. Exact field, source, and writer inventory

- [ ] 1.1 Inventory every observation INSERT/UPDATE/DELETE caller, RPC, trigger, direct role privilege, projection path, migration helper, and document purge caller.
- [ ] 1.2 Encode one maintained common immutable field set and source-specific laboratory, instrumental, and any other observation-kind source policies in database/application contracts.
- [ ] 1.3 Confirm the only mutable observation projection fields are `normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status`.
- [ ] 1.4 Prove durable deletion directly deletes observations and inventory/remove every caller of the legacy purge RPC and `easyhealth.purge_lineage` before strict rollout.

## 2. Exclusive constrained writer boundary

- [ ] 2.1 Harden the EH-106 laboratory writer with fixed search path, explicit owner/document/source/version validation, and exact creation column authority.
- [ ] 2.2 Harden atomic instrumental publication functions with fixed search path, attempt/generation/source/version validation, and exact creation/publication authority.
- [ ] 2.3 Replace broad projection mutation with one constrained writer that locks observation/revision, validates expected source/state, derives the four projection fields, and accepts no arbitrary column payload.
- [ ] 2.4 Restrict durable deletion observation DELETE authority to its fixed-search-path finalizer after tombstone/storage/writer proof.
- [ ] 2.5 Revoke direct `INSERT`, `UPDATE`, and `DELETE` on observations from `service_role`, `authenticated`, `anon`, and `PUBLIC`; retain only required SELECT and exact service-only function execute grants.

## 3. Populated preflight and reviewed backfill

- [ ] 3.1 Add retained-data preflight grouped by source type, protected field/null pattern, owner/document, authoritative source/version availability, and writer/version.
- [ ] 3.2 Generate a target-specific reviewed manifest with observation ids, expected protected old-row digests/nulls, exact target values, authoritative evidence ids/digest, owner, reviewer, and backfill version.
- [ ] 3.3 Implement a private fixed-search-path migration-only procedure that locks all targets, validates every manifest row before writing, commits atomically, and treats only exact already-applied rows as idempotent.
- [ ] 3.4 Reject missing, drifted, cross-owner, source-mismatched, unavailable-evidence, or differently changed rows without partial backfill; route only explicitly disposable data to reset/reprocess.
- [ ] 3.5 Revoke/drop the procedure and manifest staging table after attributable target application evidence; leave no runtime grant.

## 4. Strict database enforcement

- [ ] 4.1 Replace the trigger with `NEW.field IS DISTINCT FROM OLD.field` checks for every common and source-specific immutable field.
- [ ] 4.2 Add source-kind constraints/validation requiring laboratory extracted-biomarker lineage and instrumental source-measure lineage while rejecting invalid cross-source combinations.
- [ ] 4.3 Keep the four active normalization projection fields outside the immutability trigger and prove the constrained writer maintains same-source consistency.
- [ ] 4.4 Remove the caller-settable purge GUC branch, legacy lineage-nulling purge function/path, and any service-role direct fallback.

## 5. Integration and security verification

- [ ] 5.1 Replace the missing provenance runner target with a real populated-migration database integration runner and wire it plus pgTAP suites into CI.
- [ ] 5.2 Test every immutable field for null→value, value→null, changed value, and equal retry across laboratory, instrumental, and any supported non-document source type.
- [ ] 5.3 Test laboratory/instrumental creation success and required-source/version negatives through their real service functions.
- [ ] 5.4 Test valid EH-106 projection changes plus cross-owner, wrong-source, stale expected-state, and arbitrary-value rejection.
- [ ] 5.5 Test direct service_role/anon/authenticated insert/update/delete denial and exact function-execute grant negatives.
- [ ] 5.6 Test manifest success, equal rerun, drift/absence/cross-owner/evidence mismatch, whole-transaction rollback, and post-use helper removal.
- [ ] 5.7 Test durable document final deletion with strict trigger/privileges enabled and prove no surviving row has cleared identity/lineage.

## 6. Rollout and evidence

- [ ] 6.1 Verify durable deletion production evidence, pause observation writers, and run retained-data/writer/purge preflight; abort on unknown callers or unavailable mandatory source/version evidence.
- [ ] 6.2 Deploy writer-compatible functions/code, reviewed manifest backfill, strict trigger/constraints, table-privilege revocation, and purge-path removal in the documented maintenance sequence.
- [ ] 6.3 Reload PostgREST schema cache and smoke laboratory creation/projection, instrumental publication, equal retry, direct-role denial, non-document policy, and durable deletion.
- [ ] 6.4 Update `QA/eh-103/checklist.md` with separate tester-facing behavior and developer database/security evidence; mark only observed checks passed.
- [ ] 6.5 Record target manifest attribution, helper removal, purge-GUC removal, role grants, strict migration evidence, and the no-runtime-bypass Sprint 1 gate.
