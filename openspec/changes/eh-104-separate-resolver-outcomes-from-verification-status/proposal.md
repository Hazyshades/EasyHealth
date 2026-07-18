## Why

Resolver outcome and verification trust are independent dimensions, but the
current runtime entangles them. In particular, the acceptance path creates a
`user_verified` revision before it knows whether the resolver outcome is
concrete, and the promotion RPC does not protect the source relationship or
synchronize every observation projection.

EH-104 establishes the durable database contract and a secure promotion
primitive. It does not introduce a batch API or complete the user workflow.
The current writers cannot satisfy the final guards yet, so those guards must
not be enforced in a release before EH-106 has switched the writers.

## What Changes

- Define resolver outcomes as `resolved`, `partial`, `ambiguous`, and
  `unmapped` in every relevant database contract. `partial` remains a
  first-class state.
- Define revision `verification_status` as `pending`, `auto_verified`,
  `user_verified`, and `manually_corrected`. `rejected` is not a verification
  status; it is a record-lifecycle and workflow concern owned by EH-120.
- Add decision metadata to normalization revisions:
  `verification_decided_at`, `verification_actor_type`, and
  `verification_actor_id`.
- Add INSERT and UPDATE guards for the status/actor matrix and for the rule
  that a verified revision is resolved and has a measurement definition. The
  reviewed-maturity check remains a trusted service guard because the Registry
  is application code.
- Make the active normalization revision authoritative after acceptance.
  `observations.resolution_status`, `measurement_definition_key`, and
  `normalization_revision_id` are projections synchronized by promotion.
- Replace the current permissive promotion RPC with a service-only,
  compare-and-swap primitive. It verifies source/profile ownership, locks in a
  documented order, checks a complete retry no-op before CAS, protects the
  active-revision transition, and rejects mismatched or divergent projections
  rather than silently repairing them.
- Preserve append-only revisions during normal runtime. A controlled
  profile/document purge atomically unlinks both observation lineage columns
  before deleting the extracted lineage; direct revision deletion is not a
  runtime operation.
- Define the post-acceptance projection contract for
  `GET /api/documents/:id/observations`. Health Profile is not an observation
  DTO and receives no new status fields in EH-104.
- Add migration preflight and database-backed fixtures for existing rows,
  half-linked observations, guards, grants, ownership, locking, CAS, purge,
  and projection equality. The fixture suite runs as `pnpm test:eh104-db`
  against a disposable local Supabase database.

## Release Gate

EH-104 has two delivery phases:

### Phase A — backward-compatible foundation

1. Deploy only additive decision columns, the widened pre-existing revision
   verification-status domain, a read-only populated-data preflight, and the
   versioned service-only CAS primitive. New constraints on legacy
   pre-acceptance rows wait for Phase B.
2. Restrict both the legacy and versioned promotion RPCs to `service_role`.
3. Do **not** enable `MATCH FULL`, actor/cross-axis enforcement, controlled
   purge/delete enforcement, or removal of the legacy RPC. `NOT VALID` is not
   an acceptable staging mechanism because it still validates new writes.

### Phase B — follow-up after EH-106 cutover

1. EH-106 switches the existing acceptance and correction writers to the
   primitive, using `resolved -> user_verified` and
   `partial|ambiguous|unmapped -> pending`.
2. Run the read-only populated-database preflight and perform the explicitly
   approved backfill or disposable reset. Persistent environments abort without
   mutation when it finds an invalid row; explicitly disposable pre-production
   environments may reset document-derived lineage only when the reset is
   explicitly enabled. EH-104 performs no automatic semantic repair.
3. Add and enable the full same-source relation, actor/cross-axis enforcement,
   append-only/purge enforcement, and remove the legacy RPC.

Phase B enforcement MUST NOT be deployed earlier than the EH-106 writer
cutover.

## Scope Boundary

### EH-104 owns

- Resolver and verification schema contract.
- Actor/timestamp metadata and INSERT/UPDATE guards.
- Versioned service-only CAS promotion primitive, ownership checks, lock order,
  and active-revision/projection invariants.
- Migration preflight and DB-backed contract fixtures.
- The document-observations projection contract.

### Deferred work

- **EH-106:** runtime acceptance/correction cutover and per-row atomic
  integration with the promotion primitive.
- **EH-112:** incomplete-outcome DTO behavior, UI, trends, metrics, and
  consumer semantics.
- **EH-120:** record rejection, lifecycle/workflow transitions, permissions,
  reasons, batch API, idempotency, retry, and automatic-verification runtime
  activation.

## Out of Scope

- `acceptance_request_id`, operation tables, batch result shapes, aggregate
  batch state, and retry/idempotency contracts.
- Incomplete-outcome UX or changing downstream consumer eligibility.
- Full correction, reprocessing, rejection, or supersession workflow.
- Runtime wiring for `auto_verified`.
- Adding verification columns to `observations`.
- Changing scoring eligibility.

## Impact

- **Database:** Phase A revision decision metadata, a widened existing revision
  status domain, read-only diagnostics, ownership/projection integrity, and
  hardened RPC grants; Phase B adds final resolver and lineage enforcement plus
  controlled purge.
- **Runtime:** Phase A writes additive decision metadata but does not switch
  acceptance or correction control flow to v2. EH-106 is required before Phase
  B constraints are enforced in production.
- **API:** document-observations has a defined active-revision projection;
  Health Profile remains unchanged.
- **Verification:** `pnpm test:eh104-db` runs local-Supabase database fixtures
  for clean and populated-database paths, including negative authorization,
  CAS, ownership, and projection cases. Phase B extends the suite with purge
  and final-enforcement cases.
