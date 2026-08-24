## Context

EH-126 made `documents.observed_at` and observation `observed_at` nullable when the source document does not provide a complete calendar day. EH-143's strict readiness path already returns `null` for an incomplete required group, but it currently cannot explain whether a required key is absent, has an unusable reference range, has an old date, or has no date. The EH-123 recalculation pipeline stores immutable assessment payloads and input hashes, but its version row has no identity for the freshness rules used to produce that payload.

The implementation must keep factual source data visible, keep score readiness technical and non-diagnostic, and preserve the existing Registry-v2 admission boundary. It must also remain deterministic for request-time fallback and queued worker generation.

## Goals / Non-Goals

**Goals:**

- Define one explicit, versioned technical freshness policy for all eight named systems.
- Evaluate only the source medical date (`observed_at`; conceptually `measuredAt`) and preserve unknown dates as unknown.
- Exclude outdated and unknown-date observations from readiness while retaining them in the Health Profile marker/source presentation.
- Expose machine-readable freshness and readiness reasons, including separate outdated and unknown-date groups.
- Stamp the policy version in the assessment payload, durable assessment-version row, API metadata, and input hash.
- Keep UI language factual: describe old or undated evidence and how the app calculated its technical assessment without telling the user to order tests.
- Provide pure, API/worker, database, and UI-contract evidence for the acceptance criteria.

**Non-Goals:**

- Clinical recommendations, diagnosis, disease-risk prediction, or patient-specific care intervals.
- Automatically scheduling a new laboratory test, sending reminders, or adding an order/purchase flow.
- Rewriting source dates, using upload/processing time as a medical date, or inventing partial-date day precision.
- Changing Registry definitions, aliases, specimen policy, units, conversion rules, or observation persistence identity.
- Automatically recalculating every profile as a result of the wall clock advancing; freshness is evaluated when an assessment snapshot is generated, and the stamped evaluation date makes that boundary explicit.

## Decisions

### 1. Use a single explicit technical policy with a stable version

Add `src/lib/health-profile-freshness.ts` with a frozen policy object:

- version: `eh-144.v1`;
- `maxAgeDays: 365` for each named system;
- no freshness policy for `general` scoring because General is never scoreable.

The per-system map is still explicit so a later product-approved policy can change one system without changing the evaluator API. The one-year window is a product freshness heuristic only; copy and docs must not present it as a medical testing interval.

Alternative rejected: infer a window from each analyte or from common clinical practice. The Registry does not own patient-specific monitoring intervals, and doing so would turn a technical score gate into an unsafe recommendation surface.

### 2. Evaluate source dates as calendar dates, not upload timestamps

The evaluator accepts `{ measuredAt: string | null, asOf: string, maxAgeDays }` and returns `current`, `outdated`, or `unknown_date`. It parses complete `YYYY-MM-DD` values without timezone conversion. `null`, blank, malformed, or non-day source values are `unknown_date`; a date more than `maxAgeDays` before `asOf` is `outdated`; the inclusive boundary is current. Future dates are not used as evidence of staleness and are classified as unknown for fail-closed scoring.

`HealthProfileLaboratoryObservation.observed_at` and `ObservationInput.observed_at` become nullable. Latest-by-identity selection ranks complete known dates ahead of unknown dates, then orders ties by immutable observation id/document id so an unknown date cannot replace dated evidence because of fetch order. No upload, processing, `created_at`, or assessment-generation date is copied into `observed_at`.

Alternative rejected: treat an unknown date as the newest observation. That would let missing provenance hide dated evidence and would make results depend on query ordering.

### 3. Keep freshness separate from value-range status

`SystemMarker` gains `freshness_status`; its existing `status` remains the laboratory reference-range status (`in_range`, `out_of_range`, `unknown`). `resolveReadinessGroup` considers only a current, numeric, reviewed, specimen-compatible marker with a usable document reference. If no marker satisfies a group, the group reports one of `missing`, `present_without_reference`, `outdated`, or `unknown_date`, with separate `missing_groups`, `outdated_groups`, and `unknown_date_groups` arrays on `SystemScoreReadiness`.

Outdated and unknown-date markers remain in `markers`, `sources`, and source links. They are not silently deleted and do not count as satisfying readiness. Data confidence remains a separate evidence-coverage signal and is not relabeled as freshness.

Alternative rejected: overload `MarkerStatus` with `outdated`. Range status and freshness answer different questions and existing consumers rely on their independent meanings.

### 4. Stamp the complete assessment identity

`buildHealthProfileSnapshot` evaluates one `freshnessAsOf` calendar date and `freshnessEvaluatedAt` instant, includes both in the profile payload, and includes the policy version plus evaluation date in `inputHash` material. This prevents a policy change or a new evaluation day from being mistaken for the same assessment version.

The EH-123 assessment-version table gains `freshness_policy_version` with a non-null default for existing rows. The completion RPC accepts a defaulted policy-version argument, validates its shape, and writes it with every immutable version. The worker passes `HEALTH_PROFILE_FRESHNESS_POLICY.version`; the API returns the stored version in `assessment.freshness_policy_version` and falls back to the payload version for request-time snapshots.

Alternative rejected: store the version only inside JSON payload. A database column makes audit queries and version filtering reliable even when payload shape evolves; the payload copy keeps the result self-describing.

### 5. Present factual UI states without test-order prompts

The Health Profile drawer uses readiness arrays to distinguish missing, outdated, undated, and unusable-reference states. Marker rows show `Observed <date>` for a known date and `Observed date unavailable` otherwise, plus a concise freshness label. The UI may link to existing document upload/source interfaces, but it MUST NOT instruct the user to order tests, imply a diagnosis, or present an outdated result as current.

The body-map score remains `—` when readiness is not satisfied; detailed reason wording lives in the drawer so the map does not invent a new clinical state taxonomy ahead of EH-146.

### 6. Verify through focused contracts and existing release gates

Add a pure `scripts/verify-eh144-freshness-policy.ts` runner covering policy version/threshold, boundary dates, unknown dates, deterministic latest selection, readiness exclusion, and no-order copy. Add `supabase/tests/eh144_freshness_policy.sql` covering the additive column, default/backfill, completion-RPC stamp, and append-only behavior. Register both scripts in `package.json`, the CI suite policy, and the measurement-registry workflow. Update the Health Profile projection test and the EH-123 regression payload to carry the new version.

Because the Health Profile laboratory projection changes, run the Registry documentation generator, drift, Wiki render/export, and tracking-issue workflow required by repository policy; document unchanged catalog counts and any remote-publication limitation rather than claiming a Registry data change.

## Risks / Trade-offs

- **Arbitrary technical window:** A uniform 365-day window is easy to explain and audit but cannot represent every clinical context. The versioned configuration and non-diagnostic wording make the limitation explicit; changing it requires a new policy version.
- **No wall-clock scheduler:** A stored snapshot does not age itself into `outdated` without a recalculation. This avoids hidden writes and preserves EH-123's durable worker model, but a future scheduler or explicit recalculate action is needed for automatic aging.
- **Nullable date shape:** Existing UI and projection consumers assume a string. The change updates all Health Profile readers to render an unavailable date and keeps source provenance intact.
- **Old immutable payloads:** Existing EH-123 rows cannot be rewritten. The migration stamps their database column with `eh-144.v1`; new payloads include the self-describing field. Historical rows remain auditable as generated under the migration's compatibility default.
- **Readiness reason precedence:** A group can have more than one defect (for example, old data without a reference range). The group reports the strongest freshness reason while `present_without_reference` remains available for the reference-specific explanation; tests lock this precedence down.
