# EH-104 Tasks

## 1. Align schema terminology and state domains

- [x] Remove `rejected` from every EH-104 verification-status artifact; record
  rejection is deferred to EH-120.
- [x] Define revision `VerificationStatus` as
  `pending|auto_verified|user_verified|manually_corrected` and add
  `VerificationActorType = system|user`.
- [x] Update inline verification-status types in normalization policy, review
  summaries, and document viewer types.
- [x] Define stored resolver outcomes as
  `resolved|partial|ambiguous|unmapped`; permit null only on pre-resolution
  storage where explicitly required, and defer new legacy-storage constraints
  until Phase B.

## 2. Phase A: stage additive migration work

- [x] Add revision decision columns:
  `verification_decided_at`, `verification_actor_type`, and
  `verification_actor_id`.
- [x] Widen the existing revision verification-status domain and add decision
  columns without enabling final actor or cross-axis enforcement before
  compatible writers exist.
- [x] Add read-only diagnostics for unsupported extracted resolver/status values
  and, only where it still exists, the retired shadow-event table.
- [x] Establish same-source observation/revision integrity with the required
  composite uniqueness target only; defer the FK and `MATCH FULL` to Phase B.

## 3. Phase A: add the versioned promotion primitive

- [x] Define v2 promotion inputs for target revision, target observation, expected
  active revision, and service actor context.
- [x] Enforce lock order: extracted biomarker, observation, then active/target
  revisions ordered by id.
- [x] Verify same extracted source, document, and profile before activation;
  reject attempted revision reattachment to another observation.
- [x] Check strict complete no-op after locks and ownership/projection checks
  but before expected-active CAS; never rewrite metadata on that no-op.
- [x] Enforce expected-active CAS, at most one active revision, and reject a
  divergent active projection rather than repairing it implicitly.
- [x] Synchronize `measurement_definition_key`, `normalization_revision_id`,
  and `resolution_status` in the promotion transaction.
- [x] Revoke execution from `PUBLIC`, `anon`, and `authenticated`; grant only
  `service_role` for both the legacy and v2 promotion RPCs.

## 4. Phase A: define the observation projection boundary

- [x] Update `GET /api/documents/:id/observations` to project
  `resolver_result` and `verification_status` from the active linked revision.
- [x] Keep Health Profile free of new observation status fields and leave its
  scoring eligibility unchanged.
- [x] Ensure inactive candidates never alter the observation projection or
  downstream scoring inputs.

## 5. Phase A: add read-only preflight and database fixtures

- [x] Add populated-database preflight for invalid/null status values, verified
  incomplete revisions, non-reviewed definitions, half-linked rows,
  source/profile/document mismatches, multiple active revisions, and divergent
  projections.
- [x] Add `supabase/config.toml`, the pgTAP fixture file
  `supabase/tests/eh104_observation_resolution_verification.sql`, and
  `pnpm test:eh104-db` (`supabase test db --local`); document the local-stack
  setup and CI order `supabase db reset -> pnpm test:eh104-db`.
- [x] Add database-backed fixtures for INSERT and UPDATE actor/cross-axis
  guard functions without enabling them for Phase A writers.
- [x] Add fixtures for service-role grants and denied anon/authenticated RPC
  execution.
- [x] Add fixtures for source/profile mismatch, CAS stale conflict, mandatory
  lock ordering, active-revision uniqueness, strict no-op before CAS, initial
  retry with a null expected revision, and projection equality.
- [x] Add legacy and half-linked row fixtures plus clean and read-only
  populated-preflight paths.

## 6. Record deferred handoffs and Phase B release gate

- [x] Record EH-106 ownership of acceptance/correction runtime cutover and
  per-row atomic integration with the primitive.
- [x] Record EH-112 ownership of incomplete DTO behavior, UX, trends, metrics,
  and consumer semantics.
- [x] Record EH-120 ownership of record rejection, workflow transitions,
  permissions, reasons, batch/idempotency/retry API, and automatic-verification
  runtime activation.
- [x] Document the mandatory release sequence:
  Phase A additive schema/preflight/v2 -> EH-106 writers -> Phase B
  preflight/backfill/reset -> enforcement and legacy-RPC removal.

## 7. Phase B follow-up after EH-106 cutover

- [ ] Run the populated-data preflight after EH-106 writer cutover and choose
  the approved persistent abort or explicitly disposable reset path; do not use
  `NOT VALID` as a staging mechanism.
- [ ] Enable INSERT and UPDATE actor/timestamp and verified-cross-axis guards,
  including the trusted Registry reviewed-maturity guard.
- [ ] Add the final extracted resolver-result constraint after preflight proves
  compatible writers and retained data use the four-value domain.
- [ ] Replace the standalone observation-to-revision FK with the full composite
  FK and `MATCH FULL` relation after no writer can commit a half-linked row.
- [ ] Make revisions append-only, implement the controlled purge workflow, and
  add its direct-delete and purge fixtures.
- [ ] Remove the legacy promotion RPC only after every acceptance and correction
  writer uses v2.

## 8. Validate

- [x] Run `openspec validate eh-104-separate-resolver-outcomes-from-verification-status --strict`.
- [x] Verify no EH-104 task introduces an operation table,
  `acceptance_request_id`, batch aggregate status, or retry-result API.
- [x] Verify the real document-observations DTO, not Health Profile, carries
  the active-revision projection.
