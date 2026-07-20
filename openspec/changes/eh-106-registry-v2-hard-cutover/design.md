## Context

EH-104 Phase A added `promote_observation_normalization_revision_v2`. It locks the extracted row, observation, and candidate/active revisions, performs CAS, and atomically synchronizes the observation projection. It deliberately does not create the revision or observation and Phase B deliberately does not yet enforce the complete source/revision relation.

The current accept path performs the following independent service-role calls:

```text
resolve in TypeScript
  -> insert normalization revision
  -> update extracted-biomarker snapshot
  -> upsert observation
  -> legacy promotion RPC for resolved rows only
  -> update extracted status
```

The correction and undo route has the same split-write shape. A partial, ambiguous, or unmapped acceptance currently gets no active revision, despite EH-104 requiring the active revision to be authoritative for every accepted observation after the cutover. The split path can leave orphan revisions, half-linked observations, stale projections, or an accepted extracted row after a failed promotion.

The runtime also has mixed Registry 2.0 and legacy-shaped consumers. Health Profile still converts Registry 2.0 definitions to legacy-shaped system keys; trends and presentation need concrete measurement identity; reports and structured context must preserve raw incomplete rows without inventing identity. Registry v1 must cease to be a runtime fallback, while its frozen snapshot remains migration/audit input.

Finally, the committed 44-row launch fixture list is a useful seed but is not a candidate-release gate: it has no per-fixture expected outcome/identity contract, no immutable approval record, and no CI command that validates it. The current repository default branch is `master`, while the registry workflow only pushes on `main`.

## Goals / Non-Goals

**Goals:**

- Make every accepted laboratory row commit through one service-only database transaction and leave one active revision authoritative for its observation.
- Preserve incomplete accepted results as active `pending` revisions with raw evidence and nullable concrete identity.
- Give acceptance a deterministic per-row batch result contract, and correction/undo a deterministic single-row retry/conflict contract.
- Cut all runtime readers over to Registry 2.0 identity and reviewed assessment bindings without defining the final score/readiness model.
- Replace the old shadow/fallback evidence with a reproducible, non-mutating, minimum candidate-release gate for the committed launch corpus.
- Make CI enforce the release evidence and protect the repository default branch.

**Non-Goals:**

- No durable idempotency key, queued batch operation, public retry resource, rejection workflow, or automatic-verification activation; EH-120 owns those workflows.
- No multilingual, multi-laboratory, specialty-document corpus expansion, resolver-policy expansion, decision-trace UI, metrics program, or reprocessing workflow; EH-107 through EH-116 own those follow-ons.
- No final verification-status eligibility, score-required-group, null-score, freshness, score explanation, or golden-score rule; EH-141 through EH-147 own them.
- No direct removal of the legacy promotion RPC or Phase B constraints in this change. EH-104 Phase B performs those only after this writer cutover and preflight.

## Decisions

### 1. Use a database writer wrapper, not a TypeScript transaction simulation

The resolver remains code-registry logic in the trusted server. It computes a complete candidate from an extracted-row snapshot, including evidence hash, catalog/resolver versions, resolver result, candidate identity, and verification status. The server then calls one service-only database RPC with that candidate, the observation payload, actor, expected active revision, and source snapshot/version identity.

The RPC SHALL lock and revalidate the extracted row before writing. It SHALL reject a changed/non-current source snapshot, profile/document mismatch, incompatible manual definition, or stale active revision. In one PostgreSQL transaction it SHALL:

1. insert the append-only normalization revision;
2. synchronize the extracted review snapshot for that candidate;
3. upsert the source-identified observation;
4. call or incorporate the EH-104 V2 CAS primitive to activate the revision and synchronize projection fields; and
5. record the extracted acceptance status.

Any error rolls back all five operations. The RPC remains callable only by `service_role`; the public routes authenticate and verify document ownership before invoking the trusted server writer.

**Alternatives considered:**

- Keep the existing sequence and add compensating writes: rejected because a crash or retry can still expose a partially committed source of truth.
- Put resolver logic into PostgreSQL: rejected because the reviewed Registry and resolver live in versioned application code; duplicating them in SQL would create a second runtime resolver.
- Make the entire `ids[]` request one transaction: rejected because it turns an existing selection convenience into a large batch workflow and conflicts with EH-120 ownership.

### 2. An active `pending` revision is authoritative for incomplete accepted rows

`pending` means “no verification decision”, not “inactive candidate”. The state mapping is:

| Resolver and action | Verification state | Active through V2 | Concrete identity |
| --- | --- | --- | --- |
| resolved + reviewed definition + ordinary acceptance | `user_verified` | yes | present |
| partial, ambiguous, unmapped, or resolved to a non-reviewed definition + raw acceptance | `pending` | yes | nullable / absent when unresolved |
| compatible reviewed correction or undo | `manually_corrected` | yes | present |
| automatic verification | out of scope | no new path | EH-120 |

The active revision projects `measurement_definition_key` and `resolution_status` onto `observations` in the same transaction. A pending partial row therefore has an active revision, an observation projection with `resolution_status = partial`, and a null concrete definition; it does not become a fabricated measurement or assessment input.

### 3. Define narrow retry and batch semantics at the route boundary

`POST /api/documents/:id/biomarkers/accept` continues to accept `ids[]`, but the server invokes the transactional writer independently for every requested source row. The response is a successful transport response with a result for each requested id after authorization and payload validation:

```text
{ results: [{ extractedBiomarkerId, outcome, code, observationId?, revisionId? }] }
```

`outcome` distinguishes `accepted`, `already_active`, and `failed`; `code` is stable and includes `stale_revision_conflict`, `source_changed`, `not_found`, `not_actionable`, `incompatible_definition`, and `write_failed`. The viewer renders full success or partial failure from these entries rather than treating every 2xx response as full success.

`PATCH /api/documents/:id/biomarkers` remains one correction or undo per `extractedBiomarkerId`. A complete retry of the same active revision is a no-op. A stale expected revision produces HTTP 409 with `stale_revision_conflict`; any other database error rolls back the row and receives a stable safe error code. There is no durable batch result, idempotency resource, or retry queue in this change.

### 4. Consume the active Registry 2.0 projection; keep score policy separate

Document observation DTOs, biomarker presentation, definition-specific trends, conversion, structured context, reports, and Health Profile read the active revision projection on `observations`, not a post-acceptance interpretation of `document_extracted_biomarkers` or a Registry v1 fallback.

Definition-specific trends and conversion require an active resolved concrete definition. Incomplete rows remain visible as factual source observations and raw report/context input but do not enter a concrete-definition series. Health Profile admits a row to existing system mapping only after a resolved active definition has a reviewed compatible assessment binding. EH-106 does not add a verification-status or final-readiness gate to scoring; that is deferred to EH-142 and related score work.

### 5. Remove Registry v1 runtime paths with a migration-only exception

Runtime application and worker modules, feature flags, fallback branches, compatibility-only paths, and shadow/dual-read telemetry are removed. The frozen Registry v1 snapshot may be imported only by explicitly named migration/audit tooling. CI performs a static runtime-import check and fails if production runtime roots regain a Registry v1 dependency.

### 6. Use a minimum, immutable candidate-release record for the hard cutover

The first EH-106 gate uses the committed 44-row fixture corpus and existing missing-context/unit negative cases. Each fixture declares expected resolver state, expected analyte/concrete identity when applicable, required absent identity when incomplete, expected missing axes/conflicts, and value-kind/unit expectations. A candidate-run report records actual values against those expectations.

The gate thresholds are explicit: 100% raw-preservation checks; 100% expected-outcome/identity match; 0 false concrete resolutions in negative fixtures; 0 processing errors; 100% declared fixture coverage; and 0 unclassified or unapproved score-affecting binding changes. A versioned threshold policy permits future changes only through a new candidate record.

The candidate-release record is committed under a tracked registry release-artifact path and binds the manifest digest, resolver/normalization versions, corpus digest, threshold-policy version, report digest, classifications, approval entries (`approved_by`, role, timestamp, decision), and reset/rollback notes. Once approved, its digest-bound content is not amended; a changed candidate produces a new record. CI regenerates the report, verifies the matching record and approvals, and publishes the report and manifest as build artifacts.

The runner executes against in-memory or isolated fixture inputs and MUST NOT write active observations, revisions, trends, readiness, scores, or manual decisions. Before/after database fixtures prove the writer and corpus paths separately: writer tests prove intentional writes; corpus tests prove zero product-data mutations.

The current workflow must run on pull requests and on the current default branch `master` (or an intentionally broader push trigger), not only `main`.

### 7. Make roadmap handoffs explicit rather than hiding them in this gate

EH-106 owns the baseline corpus harness and immutable gate needed to remove Registry v1. EH-107 through EH-116 add future fixture breadth, resolver policies, incomplete-state UX/metrics, decision traces, and reprocessing. EH-120 owns durable public workflow semantics. EH-141 through EH-147 own the final clinical/technical score contract. This prevents the initial hard cutover from waiting on all later roadmap work while preserving their inputs and ownership.

## Risks / Trade-offs

- **Resolver output is computed outside the transaction** → The RPC locks and checks source snapshot/version and rejects changed input before persisting the candidate.
- **An acceptance batch partially succeeds** → Every row is atomic, the API returns a result for every requested id, and the viewer renders partial success rather than hiding it.
- **A pending active revision is mistaken for score eligibility** → Consumers distinguish active lineage from concrete identity; final verification/readiness eligibility stays explicitly deferred to EH-142.
- **A 44-row corpus gives false confidence** → Expected outcomes and zero-false-concrete thresholds protect the known launch set; expansion is an explicit EH-107–116 handoff, not an implied completed corpus.
- **Approval evidence is changed after review** → Candidate and report digests bind approvals; an altered candidate requires a new release record and approval.
- **Phase B is enabled too early** → EH-104 populated-data preflight and EH-105 clean/disposable database gates remain mandatory before Phase B constraints or legacy-RPC removal.

## Migration Plan

1. Add the service-only transactional writer migration and pgTAP fixtures without enabling EH-104 Phase B constraints.
2. Update trusted server writers and review UI/API contracts; verify per-row pending activation, correction/undo, no-op retry, stale conflict, and rollback behavior.
3. Cut consumers over to the active Registry 2.0 projection and remove runtime Registry v1 fallback/flag paths; retain migration/audit-only access.
4. Add expected fixture metadata, candidate runner, release record validation, CI trigger correction, and candidate artifacts.
5. Run typecheck, writer integration, registry/corpus, runtime-import, build, EH-105 clean database, and EH-104 pgTAP suites. Record environment blockers rather than treating an unavailable local stack as a pass.
6. Run EH-104 populated-data preflight. A persistent environment aborts on findings; only an explicitly disposable pre-production environment may reset through the approved path.
7. Hand off to EH-104 Phase B for actor/cross-axis guards, composite lineage enforcement, controlled purge, and legacy promotion RPC removal.

Rollback before Phase B is a deployment rollback to the last compatible writer plus a diagnostic/preflight review; it does not silently delete accepted lineage. After Phase B, rollback is governed by the Phase B migration and controlled-purge policy, not by re-enabling Registry v1.

## Open Questions

- None that block proposal authoring. The implementation must record the human approval identities in the candidate-release artifact; the approval roles are Tech Lead/QA and Clinical Product for score-affecting binding review.
