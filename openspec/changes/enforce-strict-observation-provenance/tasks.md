## 1. Exact field, source, and writer inventory

- [ ] 1.1 Inventory every observation INSERT/UPDATE/DELETE caller, RPC, trigger, direct role privilege, projection path, migration helper, and document purge caller.
  - [ ] 1.1.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.1.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.1.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.2 Encode the full required/nullable/forbidden matrix for every protected field by `lab` and `instrumental`, plus any other observation-kind source policy, in database/application contracts.
  - [ ] 1.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.2.b Execute the stated action through its approved boundary.
  - [ ] 1.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 1.3 Confirm the only mutable observation projection fields are `normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status`.
  - [ ] 1.3.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.3.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.3.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.4 Prove durable deletion directly deletes observations and inventory/remove every caller of the legacy purge RPC and `easyhealth.purge_lineage` before strict rollout.
  - [ ] 1.4.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 1.4.b Exercise the required positive and negative cases.
  - [ ] 1.4.c Record results and resolve any divergence before parent completion.

## 2. Exclusive constrained writer boundary

- [ ] 2.1 Harden/extend the EH-106 laboratory writer family as the exclusive lab authority: staging `document_extracted_biomarkers`, observation create with full provenance matrix, revision append/activation via `write_`/`promote_..._v2`, and document-scoped supersession/reprocess; fixed search path and owner/document/source/version checks; no second writer family.
  - [ ] 2.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.1.b Execute the stated action through its approved boundary.
  - [ ] 2.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.2 Harden atomic instrumental publication functions with fixed search path, attempt/generation/source/version validation, and exact creation/publication authority.
  - [ ] 2.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.2.b Execute the stated action through its approved boundary.
  - [ ] 2.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.3 Keep projection mutation inside the constrained EH-106 promote path (or one equivalent writer) that locks observation/revision, validates expected source/state, derives only the four projection fields, and accepts no arbitrary column payload.
  - [ ] 2.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.3.b Execute the stated action through its approved boundary.
  - [ ] 2.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.4 Restrict durable deletion observation/source DELETE authority to its fixed-search-path finalizer after tombstone/storage/writer proof; finalizer deletes children explicitly and does not rely on FK cascade.
  - [ ] 2.4.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.4.b Execute the stated action through its approved boundary.
  - [ ] 2.4.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.5 Revoke direct `INSERT`, `UPDATE`, and `DELETE` on observations and on authoritative revision/source tables (`observation_normalization_revisions`, `document_extracted_biomarkers`, `document_extracted_instrumental_measures`, versioned instrumental content/findings) from `service_role`, `authenticated`, `anon`, and `PUBLIC`; retain only required SELECT and exact service-only function execute grants.
  - [ ] 2.5.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 2.5.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 2.5.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 2.6 Apply the exact parent FK matrix: convert `observations` profile/document and instrumental-source FKs, extracted-biomarker profile/document FKs, revision→biomarker/observation FKs, and instrumental-measure profile/document FKs from CASCADE/SET NULL to `ON DELETE RESTRICT`/`NO ACTION`; keep already-RESTRICT/NO ACTION edges; inventory any remaining cascade/set-null edges that can clear identity.
  - [ ] 2.6.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.6.b Execute the stated action through its approved boundary.
  - [ ] 2.6.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.7 Migrate every worker/API direct laboratory biomarker/observation/revision writer onto the EH-106 family before DML revoke; preflight fails on unknown remaining direct writers.
  - [ ] 2.7.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 2.7.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 2.7.c Verify no legacy path or invalid state remains and record evidence.

## 3. Populated preflight and reviewed backfill

- [ ] 3.1 Add retained-data preflight grouped by source type, protected field/null pattern, owner/document, authoritative source/version availability, and writer/version.
  - [ ] 3.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.2 Generate a target-specific reviewed manifest with observation ids, expected protected old-row digests/nulls, exact target values, authoritative evidence ids/digest, owner, reviewer, and backfill version.
  - [ ] 3.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.2.b Execute the stated action through its approved boundary.
  - [ ] 3.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.3 Implement a private fixed-search-path migration-only procedure that locks all targets, validates every manifest row before writing, commits atomically, and treats only exact already-applied rows as idempotent.
  - [ ] 3.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.3.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.4 Reject missing, drifted, cross-owner, source-mismatched, unavailable-evidence, or differently changed rows without partial backfill; route only explicitly disposable data to reset/reprocess.
  - [ ] 3.4.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.4.b Execute the stated action through its approved boundary.
  - [ ] 3.4.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.5 Revoke/drop the procedure and manifest staging table after attributable target application evidence; leave no runtime grant.
  - [ ] 3.5.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 3.5.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 3.5.c Verify no legacy path or invalid state remains and record evidence.

## 4. Strict database enforcement

- [ ] 4.1 Replace the trigger with `NEW.field IS DISTINCT FROM OLD.field` checks for every common and source-specific immutable field.
  - [ ] 4.1.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 4.1.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 4.1.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 4.2 Add source-kind constraints/validation implementing the full lab/instrumental required/nullable/forbidden matrix and rejecting invalid cross-source combinations.
  - [ ] 4.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 4.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 4.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 4.3 Keep the four active normalization projection fields outside the immutability trigger and prove the constrained writer maintains same-source consistency.
  - [ ] 4.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.3.b Execute the stated action through its approved boundary.
  - [ ] 4.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.4 Remove the caller-settable purge GUC branch, legacy lineage-nulling purge function/path, and any service-role direct fallback.
  - [ ] 4.4.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 4.4.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 4.4.c Verify no legacy path or invalid state remains and record evidence.

## 5. Integration and security verification

- [ ] 5.1 Replace the missing provenance runner target with a real populated-migration database integration runner and wire it plus pgTAP suites into CI.
  - [ ] 5.1.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 5.1.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 5.1.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 5.2 Test every immutable field for null→value, value→null, changed value, and equal retry across laboratory, instrumental, and any supported non-document source type.
  - [ ] 5.2.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.2.b Exercise the required positive and negative cases.
  - [ ] 5.2.c Record results and resolve any divergence before parent completion.

- [ ] 5.3 Test laboratory/instrumental creation success and required-source/version negatives through their real service functions.
  - [ ] 5.3.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.3.b Exercise the required positive and negative cases.
  - [ ] 5.3.c Record results and resolve any divergence before parent completion.

- [ ] 5.4 Test valid EH-106 projection changes plus cross-owner, wrong-source, stale expected-state, and arbitrary-value rejection.
  - [ ] 5.4.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.4.b Exercise the required positive and negative cases.
  - [ ] 5.4.c Record results and resolve any divergence before parent completion.

- [ ] 5.5 Test direct service_role/anon/authenticated insert/update/delete denial on observations and authoritative revision/source tables, plus exact function-execute grant negatives.
  - [ ] 5.5.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.5.b Exercise the required positive and negative cases.
  - [ ] 5.5.c Record results and resolve any divergence before parent completion.

- [ ] 5.6 Test manifest success, equal rerun, drift/absence/cross-owner/evidence mismatch, whole-transaction rollback, and post-use helper removal.
  - [ ] 5.6.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.6.b Exercise the required positive and negative cases.
  - [ ] 5.6.c Record results and resolve any divergence before parent completion.

- [ ] 5.7 Test durable document final deletion with strict trigger/privileges enabled and prove no surviving row has cleared identity/lineage.
  - [ ] 5.7.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.7.b Exercise the required positive and negative cases.
  - [ ] 5.7.c Record results and resolve any divergence before parent completion.

- [ ] 5.8 Test indirect observation mutation/deletion attempts through instrumental measure, extracted biomarker, revision, document, and profile parent paths and prove RESTRICT/finalizer-only behavior. for every edge in the FK matrix.
  - [ ] 5.8.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.8.b Exercise the required positive and negative cases.
  - [ ] 5.8.c Record results and resolve any divergence before parent completion.

- [ ] 5.9 Test laboratory lifecycle through the EH-106 family only: stage biomarkers, create observation, append/activate revision, supersede/reprocess, and prove direct table DML denial after revoke.
  - [ ] 5.9.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 5.9.b Exercise the required positive and negative cases.
  - [ ] 5.9.c Record results and resolve any divergence before parent completion.

## 6. Rollout and evidence

- [ ] 6.1 Verify durable deletion production evidence, pause observation writers, and run retained-data/writer/purge preflight; abort on unknown callers or unavailable mandatory source/version evidence.
  - [ ] 6.1.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 6.1.b Exercise the required positive and negative cases.
  - [ ] 6.1.c Record results and resolve any divergence before parent completion.

- [ ] 6.2 Deploy writer-compatible functions/code, reviewed manifest backfill, strict trigger/constraints, table-privilege revocation, and purge-path removal in the documented maintenance sequence.
  - [ ] 6.2.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 6.2.b Execute the stated operation within the declared safety gates.
  - [ ] 6.2.c Capture attributable smoke, negative-case, and completion evidence.

- [ ] 6.3 Reload PostgREST schema cache and smoke laboratory creation/projection, instrumental publication, equal retry, direct-role denial, non-document policy, and durable deletion.
  - [ ] 6.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 6.3.b Execute the stated action through its approved boundary.
  - [ ] 6.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 6.4 Update `QA/eh-103/checklist.md` with separate tester-facing behavior and developer database/security evidence; mark only observed checks passed.
  - [ ] 6.4.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 6.4.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 6.4.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 6.5 Record target manifest attribution, helper removal, purge-GUC removal, role grants, strict migration evidence, and the no-runtime-bypass Sprint 1 gate.
  - [ ] 6.5.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 6.5.b Perform the stated review or preflight against the defined invariants.
  - [ ] 6.5.c Publish attributable findings and block unresolved or unsafe results.

