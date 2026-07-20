## 1. Establish the transactional Registry 2.0 writer

- [ ] 1.1 Inventory every acceptance, correction, undo, and direct normalization-revision/observation writer; define the single service-only RPC input/output contract and remove writer bypasses from the target paths.
- [ ] 1.2 Add the migration for the service-only transactional writer, its typed/safely validated candidate payload, snapshot/version recheck, ownership checks, and least-privilege grants.
- [ ] 1.3 Implement one-transaction revision insert, extracted snapshot update, source-identified observation upsert, V2 CAS activation/projection sync, and extracted acceptance-status update.
- [ ] 1.4 Encode the resolver/verification state matrix: reviewed resolved ordinary acceptance → `user_verified`; incomplete or non-reviewed ordinary acceptance → active `pending`; compatible manual correction/undo → `manually_corrected`; reject automatic-verification activation in this change.
- [ ] 1.5 Preserve EH-104 lock order, active-revision CAS/no-op behavior, source/profile/document checks, and projection-equality failures through the wrapper.
- [ ] 1.6 Add pgTAP/database fixtures for committed pending incomplete lineage, reviewed user verification, manual correction/undo, source-snapshot change, rollback at each write stage, stale CAS conflict, no-op retry, and direct-client denial.

## 2. Cut over acceptance and manual-review APIs

- [ ] 2.1 Refactor the trusted acceptance service to compute a candidate from a validated extracted snapshot and call the transactional writer instead of independently inserting/upserting/promoting.
- [ ] 2.2 Update `POST /api/documents/:id/biomarkers/accept` to process each requested id independently and return a stable result entry for every id, including accepted/no-op/failure outcomes and safe codes.
- [ ] 2.3 Update the single-row correction/undo route to call the transactional writer, return HTTP 409 for stale CAS, and preserve manual history and compatible-definition validation.
- [ ] 2.4 Remove all target-path calls to `promote_observation_normalization_revision` and add a static check proving only the V2 wrapper is used by acceptance/correction/undo.
- [ ] 2.5 Update document review UI state to render complete versus partial selected-row acceptance, pending raw acceptance, and safe correction/undo conflict feedback; refresh authoritative bootstrap state after successful rows.
- [ ] 2.6 Add route and UI integration tests for authorization, malformed input, mixed acceptance results, incomplete pending activation, correction/undo no-op retry, stale conflict, and no partial writes on failure.

## 3. Cut runtime consumers over to active Registry 2.0 identity

- [ ] 3.1 Update document observation queries/bootstrap DTOs to expose active revision resolver and verification dimensions with nullable Registry 2.0 identity.
- [ ] 3.2 Update biomarker presentation, safe conversion, and definition-specific trend grouping to use active `measurement_definition_key`; retain incomplete factual rows but exclude them from concrete series/conversion.
- [ ] 3.3 Update structured context and reports to carry raw Registry 2.0 observations and resolver state without generating legacy fallback identity.
- [ ] 3.4 Update Health Profile admission to use active resolved definitions with reviewed compatible assessment bindings while preserving EH-141–147 ownership of final verification/readiness/scoring policy.
- [ ] 3.5 Remove Registry v1 runtime adapters, compatibility-only/fallback branches, feature flags, dual-read/shadow telemetry, and stale rollout documentation; retain only explicit migration/audit tooling exceptions.
- [ ] 3.6 Extend runtime-import and consumer regression checks for document observations, overview/trends, reports/context, conversion, and Health Profile.

## 4. Build the minimum hard-cutover candidate-release gate

- [ ] 4.1 Extend the committed 44-row fixture format with expected resolver state, identity/null identity, missing-axis/conflict, value-kind, and unit assertions; add committed missing-context/unit negative fixtures.
- [ ] 4.2 Implement a non-mutating candidate runner that evaluates the selected Registry/resolver release and emits deterministic row-level and aggregate raw-preservation, outcome, false-concrete-resolution, error, and assessment-impact results.
- [ ] 4.3 Define and version the minimum threshold policy: 100% raw preservation, expected-outcome/identity match, and declared fixture coverage; zero false concrete resolutions and processing errors; zero unclassified/unapproved score-affecting binding changes.
- [ ] 4.4 Create the tracked digest-bound candidate-release record format containing manifest/corpus/report digests, versions, classifications, approvals with actor/role/time/decision, threshold-policy version, and reset/rollback notes.
- [ ] 4.5 Add validation that rejects mismatched, amended, unclassified, or unapproved candidate evidence and does not treat a declared fixture name as a passed corpus result.
- [ ] 4.6 Add corpus fixtures proving zero mutation of active observations, revisions, trends, readiness, scores, and manual decisions; keep writer mutation tests separate from corpus tests.

## 5. Enforce the release gate and record handoffs

- [ ] 5.1 Update the registry GitHub Actions workflow to run on pull requests and the `master` default branch (or an intentionally broader push trigger), execute writer/registry/corpus/import checks, and publish manifest/report artifacts.
- [ ] 5.2 Run and record typecheck, production build, Registry 2.0 resolver/identity/corpus checks, writer route/UI integration tests, and the runtime-import check.
- [ ] 5.3 Run the outstanding EH-105 clean `supabase db reset`, database/API/worker fixtures, and the EH-104 pgTAP suite in a disposable environment; record any environment blocker rather than treating it as a pass.
- [ ] 5.4 Run the EH-104 populated-data preflight after compatible writers are deployed; choose and record persistent abort or explicitly disposable reset before requesting Phase B enforcement.
- [ ] 5.5 Generate and review the first candidate manifest, corpus report, threshold result, score-affecting binding classifications, approvals, and reset/rollback notes.
- [ ] 5.6 Record the explicit handoffs to EH-107–116 (corpus/resolver/UX/reprocessing expansion), EH-120 (durable batch/retry/rejection/automatic verification), and EH-141–147 (final score/readiness); do not implement those workflows here.
