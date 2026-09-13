## Context

EH-146 established a profile-wide assessment lifecycle axis with `current`, `processing`, `outdated`, and `error` states. The current API route already reads the latest append-only assessment version and the singleton recalculation job, validates the persisted readiness payload, chooses a request-time snapshot fallback for legacy or malformed payloads, and returns lifecycle metadata. The pure mapper in `src/lib/health-profile-assessment-state.ts` owns the basic job-status mapping.

The remaining seam is the assembly around that mapper. `src/app/api/health-profile/route.ts` owns payload validation, persisted-versus-fallback selection, lifecycle derivation, and metadata assembly. The profile page defensively recomputes the lifecycle when metadata is absent, while the dashboard falls back to `current`. The body map, card, and drawer receive lifecycle props, but also derive per-system observation-freshness and readiness explanations. Those are intentional score/readiness concerns, not profile lifecycle.

The change is a behavior-preserving refactor across the Health Profile API and its dashboard/profile consumers. EH-123 assessment jobs, immutable versions, receipts, and RPCs remain the persistence authority. EH-144 freshness metadata and EH-146's separation between lifecycle and score evidence remain unchanged.

## Goals / Non-Goals

**Goals:**

- Create one pure assessment read projection that classifies the latest persisted payload, selects persisted or fallback profile data, and assembles the existing assessment metadata contract.
- Keep profile-scoped database access, authentication, synthesis reads, and snapshot fallback I/O in the API route adapter.
- Make the successful API response the single source of the profile-wide lifecycle fact; clients consume `assessment.display_state` rather than re-deriving it or defaulting it independently.
- Preserve the exact legacy/malformed payload fallback behavior and every existing lifecycle state transition.
- Keep the profile-wide lifecycle axis separate from system score/readiness, observation freshness, and document-processing status.
- Add direct, deterministic coverage for the read projection instead of testing the route only through source-text assertions or browser behavior.

**Non-Goals:**

- No changes to score formulas, readiness groups, assessment admission, exclusions, provenance, or observation-level freshness.
- No change to the `HealthProfileAssessment` payload shape, canonical snapshot hash, or worker output.
- No database migration, RPC, job, version, receipt, or persistence redesign.
- No realtime subscription, polling loop, scheduler, or new system-level lifecycle status.
- No transactional replacement of the separate version/job reads; consistency across those reads is a separate concern.
- No Resolver, historical persisted-decision reader, document-processing, or synthesis behavior changes.

## Decisions

### D1 — Use a pure projection behind the existing route adapter

Add a focused module such as `src/lib/health-profile-assessment-read.ts`. It accepts the already-read version row, job row, and optional `HealthProfileSnapshot` fallback, then returns the selected `HealthProfileAssessment` and the existing assessment metadata object. It does not create a Supabase client, inspect a session, call the worker, or perform persistence.

The route remains responsible for authentication, profile-scoped reads, the conditional `buildHealthProfileSnapshot` call, synthesis loading, and HTTP headers. This preserves the existing authorization and I/O boundary while giving the compatibility and lifecycle rules one directly testable owner.

**Alternative rejected:** Move all database reads and fallback generation into a new assessment service. There is one production API adapter and no second persistence adapter; that design would add dependency-injection and authorization complexity without a current consumer that needs it.

### D2 — Treat canonical payload classification as part of the read contract

Move the existing `hasCanonicalReadinessContract` behavior and its reported-result shape checks into the assessment-read boundary. A payload is usable only when it has the current readiness shape, required reported-result counters, valid systems/readiness arrays, and the current freshness policy version. A legacy, malformed, or policy-incompatible payload is not exposed as the current persisted profile; the route builds the existing request-time fallback and the projection marks the result as fallback with no current persisted version.

The projection must distinguish a usable canonical version from mere presence of a row in `health_profile_assessment_versions`. This preserves the current meaning of `has_current_version` and prevents a retired payload shape from silently reaching clients.

**Alternative rejected:** Return any latest JSON payload and let each client tolerate old fields. That recreates the exact cross-surface drift EH-146 was intended to prevent.

### D3 — Keep the existing lifecycle truth table

The projection delegates to `resolveAssessmentDisplayState` or keeps its equivalent mapping in the existing lifecycle module. The observable table remains:

| Usable persisted version | Job status | Display state | Profile source |
| --- | --- | --- | --- |
| yes | `succeeded` or missing | `current` | persisted |
| yes | `queued` or `processing` | `outdated` | persisted |
| yes | `failed` or `retryable_failed` | `error` | persisted |
| no | `queued`, `processing`, `succeeded`, or missing | `processing` | fallback |
| no | `failed` or `retryable_failed` | `error` | fallback |

The existing status, fallback, version, hash, timestamp, policy, attempt, and error fields remain populated from the same sources. A failed or queued job never erases a usable last completed profile.

**Alternative rejected:** Infer lifecycle from `assessment_freshness`, null scores, marker freshness, or document status. Those fields belong to different axes and would reintroduce the EH-143/EH-146 conflation.

### D4 — Make clients consume, not interpret, profile lifecycle

The profile page and dashboard use the shared assessment metadata type and the server-provided `display_state`. Remove the profile-page fallback call to `resolveAssessmentDisplayState` and the dashboard's unconditional `current` default from the successful-response path. Keep the existing narrowed `assessmentState` and `assessmentError` props passed to `OverallAssessmentCard`, `BodyMap`, `HealthProfileDrawer`, and the dashboard widget.

Do not pass version rows, job rows, or fallback internals to presentation components. Keep `unavailableFreshnessStatus`, drawer readiness explanations, `assessment_freshness`, and document `processingDocuments` logic on their existing separate contracts.

**Alternative rejected:** Pass the whole assessment-read object through every component. It would widen presentation interfaces with persistence details and make accidental axis coupling easier.

### D5 — Preserve the external API and persistence contracts

The route keeps the current successful response fields, `Cache-Control: no-store`, session authorization, synthesis fields, nullable scores, readiness details, `assessment.display_state`, `assessment.has_current_version`, and `assessment.fallback`. Lifecycle metadata remains derived at read time and is not added to immutable assessment payloads or database columns.

No worker or completion-RPC changes are required. The worker continues to use `buildHealthProfileSnapshot` and persist the same payload and version metadata.

**Alternative rejected:** Persist lifecycle state inside `HealthProfileAssessment`. Job status is mutable and would make an append-only payload stale by construction.

### D6 — Verify the projection at its narrow seam

Add a deterministic verifier for the pure projection covering canonical, missing, legacy, malformed, and policy-incompatible payloads across all job statuses. Assert the selected profile source, `has_current_version`, `fallback`, `display_state`, retained version metadata, and error metadata. Extend the existing route/API contract checks to ensure the route still performs profile-scoped reads and no-store responses. Retain the EH-146 state and drawer checks as regressions for score/readiness-axis separation.

## Risks / Trade-offs

- **[Semantic drift]** Moving validation or fallback branches can change which payload is served. → Copy the current validation predicates and lock the full state matrix with pure projection fixtures before changing clients.
- **[Axis conflation]** A per-system `outdated` or `unknown_date` marker can be mistaken for profile lifecycle `outdated`. → Keep the two type families and their consumers separate; explicitly test stale evidence alongside an `outdated` lifecycle state.
- **[Legacy compatibility]** Older payloads may omit readiness or reported-result fields. → Preserve request-time fallback, `fallback=true`, `has_current_version=false`, and the existing safe `processing`/`error` interpretation.
- **[Read race]** Version and job are still read in separate database queries. → Document that the pure projection cannot provide transaction-level consistency; handle that separately if a concrete inconsistent-read bug appears.
- **[Client contract drift]** A client may still receive a malformed response at runtime. → Keep the API metadata type shared and require `display_state` for successful responses; do not silently invent a new lifecycle state in individual clients.
- **[Test gap]** Pure projection tests cannot prove database authorization or cross-query consistency. → Retain existing authenticated/API and database lifecycle evidence; add no claim that the refactor changes those boundaries.

## Migration Plan

1. Add the new projection types and pure functions alongside the current route logic.
2. Add the state-matrix verifier and prove parity against the existing EH-146 and API contracts.
3. Move payload validation and metadata assembly into the projection without changing route reads or snapshot fallback invocation.
4. Migrate the profile page and dashboard to consume the required server-projected lifecycle state; leave map, card, and drawer evidence/readiness logic unchanged.
5. Run focused lifecycle, drawer, EH-123, EH-144, and API checks, then remove the obsolete route/client interpretation paths.

Rollback is application-only: restore the previous route/client assembly while leaving all database rows, immutable payloads, jobs, and RPCs untouched. The projection module can remain unused during rollback because it has no persistence side effects.

## Open Questions

None block implementation. Exact helper names and whether the shared metadata type lives beside the projection or in a small types module are implementation details; the input/output contract and state table are fixed by this design.
