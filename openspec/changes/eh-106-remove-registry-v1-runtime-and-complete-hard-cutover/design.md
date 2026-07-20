## Context

EH-102 introduced Registry 2.0 analyte and measurement-definition identity;
EH-103 made laboratory provenance and normalization revisions durable; EH-104
Phase A added the service-only
`promote_observation_normalization_revision_v2` compare-and-swap primitive;
and EH-105 moved instrumental observations to a separate, source-backed
lineage. Those changes deliberately left two pre-launch handoffs unresolved:

- legacy acceptance and correction writers still do not uniformly use the v2
  promotion primitive; and
- runtime consumers can still reach v1-derived launch-catalog behavior.

The remaining legacy path is not limited to a direct frozen-fixture import.
`launch-catalog.generated.ts` and `launch-registry.ts` carry v1-derived alias,
conversion, score-role, system, and readiness behavior into extraction, unit,
and health-system consumers. EH-106 removes that whole runtime semantic model,
not just its source import.

EH-106 is the boundary between additive migration work and an all-Registry-2.0
runtime. It affects document processing, acceptance and correction routes,
read models, Health Profile, reports, assessment, registry tooling, CI, and
release QA. EH-104 Phase B remains a follow-on owner of final database
enforcement and legacy-promotion-RPC removal; it starts only after compatible
EH-106 writers are deployed and its preflight is clean.

## Goals / Non-Goals

**Goals:**

- Establish Registry 2.0 as the sole runtime authority for laboratory semantic
  identity and reviewed measurement bindings.
- Route every acceptance and correction writer through EH-104's service-only
  v2 promotion primitive while retaining its lock, ownership, CAS, and
  projection guarantees.
- Preserve raw evidence and safely distinguish user-verified resolved results
  from accepted but incomplete results.
- Move user-facing and downstream consumers to the active Registry 2.0
  revision/read model without inferring missing specimen or definition data.
- Make release-candidate evaluation reproducible and non-mutating, with
  fixtures, report segments, thresholds, approvals, and CI evidence.

**Non-Goals:**

- Do not enable EH-104 Phase B database guards, `MATCH FULL`, controlled purge
  enforcement, or remove the legacy promotion RPC in this change.
- Do not automatically verify a result, invent a concrete measurement
  definition, or backfill untrustworthy legacy data.
- Do not treat instrumental observations as Registry 2.0 laboratory markers;
  their typed lineage remains governed by EH-105.
- Do not make a candidate-corpus run write active observations, revisions,
  trends, readiness, scores, or manual decisions.

## Decisions

### 1. Create one explicit Registry 2.0 runtime boundary

Application and worker code will resolve laboratory identity through the
Registry 2.0 resolver and reviewed definitions only. The frozen Registry v1
snapshot and v1-derived launch catalog are retained exclusively behind a
narrow migration/audit-tooling boundary; they are not application, worker,
API, UI, or normal runtime-script dependencies. Registry v1 adapters,
compatibility-only behavior, resolution-mode feature flags, and dual-read
telemetry are removed rather than left dormant.

This is safer than retaining a kill switch: a switch that can restore v1 means
v1 remains a production runtime contract that must be maintained and tested.
The CI static check protects both direct and generated-v1 dependency paths.

### 2. Integrate existing writers with the v2 primitive per selected row

Acceptance and correction flows retain their existing public request shapes,
including `ids[]`, but each selected laboratory observation is handled by a
service-only per-row database writer. It creates or reuses a same-source
observation and target revision, then invokes the service-role v2 promotion
primitive with an expected active revision in one transaction. The route/service
layer derives status and actor metadata before that call and never reimplements
database locking, source/profile checks, CAS, or observation projection
updates.

For user acceptance, a resolved result whose selected definition is reviewed
becomes `user_verified`. A raw accepted `partial`, `ambiguous`, or `unmapped`
result is materialized as `pending` with no invented concrete definition.
User corrections that select a reviewed concrete definition become
`manually_corrected`. Each row is independently atomic; this change does not
introduce a batch-operation table, aggregate retry contract, or automatic
verification path.

Using a transactional writer around the v2 primitive rather than separately
upserting an observation, inserting a candidate, and promoting it from route
code preserves EH-104's deterministic lock order and idempotent retry
semantics. It prevents a failed initial acceptance from committing a
source-only or half-linked observation, and makes later Phase B enforcement an
additive database change rather than a rewrite of application writers.

### 3. Read consumers from the active Registry 2.0 projection

Document, biomarker, trend, report, structured-context, conversion, and
assessment consumers receive laboratory identity from the active revision and
its synchronized observation projection. A concrete, score-eligible
measurement requires a reviewed Registry 2.0 binding; incomplete outcomes
remain visible as raw evidence but cannot enter concrete conversion or
assessment paths. All laboratory aggregations explicitly exclude instrumental
observations.

This centralizes meaning at the active revision rather than allowing each
consumer to reconstruct or fall back to legacy identity. It makes UI behavior
consistent with API and scoring behavior and avoids silently choosing specimen
or units that are absent from the source.

### 4. Evaluate release candidates with a pure corpus runner

A deterministic candidate-corpus command reads a versioned fixture manifest,
Registry 2.0 candidate data, and representative de-identified documents. It
returns a segmented report and candidate manifest containing input hashes,
fixture coverage, classifications, threshold results, approval references, and
reset/rollback notes. It is deliberately implemented as a pure evaluator: it
does not call acceptance, correction, promotion, trend, readiness, score, or
manual-decision writers.

The policy file holds numerical thresholds and named approval roles. CI
validates fixture completeness, classifications, score-affecting review,
approval evidence, and report/manifest reproducibility before a candidate is
considered launchable. This replaces legacy/shadow comparison with a release
gate that directly tests the Registry 2.0 product contract.

### 5. Gate removal structurally and behaviorally

The Registry v1 import checker is expanded into the enforceable CI boundary,
with narrow exclusions for frozen-fixture migration/audit tooling and
historical artifacts. Focused tests cover writer status semantics, v2 RPC
arguments and failures, consumer filtering, and corpus non-mutation. The
complete verification command combines those checks with the clean build and
existing Registry/assessment regression suites.

Static checking catches forbidden dependency reintroduction early; behavioral
tests prove that removal did not merely move legacy semantics behind a wrapper.

## Risks / Trade-offs

- **[A still-active caller bypasses the v2 promotion primitive]** -> Inventory
  all acceptance/correction entry points, test them against a mocked/service
  RPC boundary, and make direct client execution unavailable.
- **[Removing the flag reveals a latent v2 mapping gap]** -> Preserve raw
  `partial`, `ambiguous`, and `unmapped` evidence, use the candidate corpus to
  expose the gap, and require an approved remediation rather than falling back
  to Registry v1.
- **[A consumer treats a pending raw result as a concrete measurement]** ->
  Centralize reviewed-binding eligibility and add API/UI/assessment regression
  tests that reject incomplete outcomes from conversion and score inputs.
- **[Candidate validation accidentally changes patient state]** -> Keep the
  runner dependency-free from writer services, run it on fixture inputs, and
  assert no mutation calls or data changes in its tests.
- **[Approval evidence becomes stale or unverifiable]** -> Bind approvals and
  thresholds to manifest/input hashes and fail CI on missing, mismatched, or
  unclassified evidence.
- **[Phase B is enabled before compatible writers are live]** -> Leave Phase B
  migrations out of EH-106 and require the EH-104 preflight/deployment
  sequence as an explicit post-cutover handoff.

## Migration Plan

1. Inventory and remove Registry v1 runtime imports, generated-v1 launch
   catalog dependencies, adapters, flags, and dual-read paths while preserving
   the frozen audit/migration tooling boundary.
2. Update acceptance and correction services/routes to construct v2 promotion
   inputs per row; add tests for resolved acceptance, incomplete raw
   acceptance, manual correction, stale CAS, source/profile rejection, and
   idempotent retry behavior.
3. Migrate consumer read models and UI/API/assessment paths to reviewed active
   Registry 2.0 bindings; prove incomplete and instrumental records do not
   become concrete laboratory inputs.
4. Add candidate fixtures, policy, pure runner, manifest/report generation,
   approval validation, and CI checks. Record user-facing QA in
   `QA/eh-106/checklist.md`.
5. On a disposable environment, run the database reset/fixture suites,
   candidate corpus, Registry/assessment regressions, typecheck, and production
   build. For persistent environments, record preflight diagnostics without
   mutation.
6. Deploy compatible application/worker code first, then run EH-104 populated
   data preflight. EH-104 Phase B may be scheduled only after the cutover and
   approved preflight/reset path; rollback is forward-only and never restores
   Registry v1 runtime behavior.

## Open Questions

- No implementation-blocking question remains. Numerical thresholds and named
  approval owners are versioned candidate-release policy inputs and must be
  supplied with each candidate manifest rather than inferred at runtime.
