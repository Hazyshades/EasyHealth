## Context

EH-104 made the active normalization revision authoritative and separated resolver outcome from verification trust. EH-106 moved acceptance and correction onto that writer and retained raw acceptance of incomplete rows as `pending`. EH-111 completed compatibility eligibility and guarantees that only an active `resolved` reviewed binding exposes concrete identity or conversion.

The remaining consumers are inconsistent. The document detail API recomputes a current-catalog preview even when a persisted active revision exists, document-observation and Biomarkers DTOs expose different subsets of outcome evidence, the document viewer uses incomplete wording for only some states and renders internal candidate keys, and trend/assessment exclusions are implicit booleans rather than an inspectable contract. Reprocessing already exists at document level and preserves append-only lineage, but incomplete rows do not have an explicit visibility/reprocess invariant. There is no dedicated outcome metric contract.

EH-112 spans the documents and health-profile domains. It must consume the EH-111 decision shape, not alter resolver selection, EH-104/EH-106 writers, or historical revisions.

## Goals / Non-Goals

**Goals:**

- Serialize all four active resolver outcomes consistently from the authoritative revision.
- Preserve user-visible raw result and source evidence when semantic identity is incomplete.
- Provide safe English labels, guidance, and technical details without presenting candidates as active identity.
- Keep incomplete results available to the existing document-level reprocess workflow.
- Make trend, conversion, report, structured-context, and assessment eligibility explicit and testable.
- Emit privacy-safe aggregateable metrics for outcomes and consumer exclusions.
- Prove the contract with resolved, partial, ambiguous, and unmapped end-to-end fixtures.

**Non-Goals:**

- Change EH-111 candidate generation, compatibility, scoring, outcome selection, or conversion eligibility.
- Add a second matcher, infer missing clinical context, or promote a candidate from decision evidence.
- Change the EH-104 schema guards or EH-106 acceptance/correction RPC.
- Add per-row reprocessing, revision selection, bulk reprocessing, or support trace access; EH-116 and EH-115 own those concerns.
- Backfill or reinterpret historical normalization revisions.
- Make incomplete rows contribute to definition-specific charts, readiness, confidence, reports, or scores.

## Decisions

### 1. Project one consumer-safe outcome summary

Add a pure projector shared by document, Biomarkers, reports, structured context, and Health Profile consumers. It accepts the observation/extracted raw fields plus the active normalization revision and returns:

- `outcome`: `resolved | partial | ambiguous | unmapped`;
- `verificationStatus`;
- nullable `measurementDefinitionKey` and `analyteKey`;
- mapping confidence and band;
- `missingAxes`, conflict reason codes, support reason codes, and candidate count;
- catalog, resolver, normalization, trace, and compatibility-policy versions where present;
- eligibility booleans and exclusion reasons for trend, conversion, report/structured context, and assessment;
- `source`: `active_revision` or `preview`.

An active revision is authoritative. The projector may use a current-catalog preview only for an extracted row that has never been accepted and therefore has no active revision. Preview data is labeled `preview`, is never treated as verified identity, and cannot grant trend, conversion, report, structured-context, or assessment eligibility.

Alternative rejected: let each route interpret `resolver_evidence`. That duplicates safety decisions and allows drift between UI, trends, and scoring.

### 2. Preserve stable public fields and add a nested details contract

Existing public fields such as `resolution_status`, `verification_status`, `measurement_definition_key`, and `registry_binding_ready` remain because multiple current consumers use them. EH-112 makes them projections of the shared outcome summary and adds `resolution_details` for structured explanation.

For `partial`, `ambiguous`, and `unmapped`, `measurement_definition_key` and `analyte_key` are null even if decision evidence contains candidate keys. `resolution_details` contains only reason codes, missing axes, candidate count, confidence, versions, source, and eligibility/exclusion fields. It does not expose raw candidate keys or a selected evidence key as active identity. Full support traces remain EH-115 scope.

Alternative rejected: expose the complete persisted trace in every API. It leaks implementation detail, increases payloads, and invites clients to promote evidence-only candidates.

### 3. Raw evidence is independent of semantic identity

Document review DTOs retain the source label, value text/numeric value, raw and normalized unit, raw reference range, specimen, modifier, page, source text, extraction confidence/model/version, and extracted-row identifier for every outcome. Observation DTOs retain their immutable observation provenance and source extracted-row identifier.

The UI renders the raw result first. Outcome wording explains mapping state without changing or hiding the source value:

| Outcome | Label | Guidance |
| --- | --- | --- |
| `resolved` | `Matched measurement` | Mapping confidence is classification evidence, not medical certainty. |
| `partial` | `More details needed` | The result is recognized, but required context is missing. |
| `ambiguous` | `Multiple possible matches` | More than one reviewed measurement remains possible; none was selected. |
| `unmapped` | `Measurement not recognized` | The raw result is preserved but no authorized Registry 2.0 candidate matched. |

Technical details show confidence, missing fields, conflict/support reason labels, candidate count, verification state, and version metadata. Internal keys are not rendered as a confirmed mapping for incomplete states.

Alternative rejected: hide incomplete rows from Biomarkers or document review. That loses clinically relevant source evidence and prevents users from reprocessing or reviewing it.

### 4. Reprocessing remains document-scoped and append-only

EH-112 reuses `POST /api/documents/:id/reprocess`. Every document containing an incomplete current row keeps a visible **Reprocess document** action. A successful reprocess queues a new full pipeline run; current extraction rows are superseded according to the existing lineage contract, while historical extracted rows and normalization revisions remain intact.

EH-112 does not add a row identifier to the reprocess request and does not delete or mutate prior decisions.

Alternative rejected: targeted row reprocessing. The worker currently publishes document snapshots; adding row-level orchestration would overlap EH-116 and weaken snapshot consistency.

### 5. Consumer eligibility is explicit and centrally derived

The shared summary returns deterministic exclusions:

- `trendEligible` and `conversionEligible` require the EH-111 active resolved reviewed binding.
- `reportEligible` and `structuredContextEligible` require the same concrete binding for definition-specific interpretation; raw document evidence may still be cited separately by existing document context.
- `assessmentEligible` additionally requires a reviewed assessment binding with `compatibility = compatible` and a non-display score role where the existing health model requires it.

Incomplete rows remain list-visible but never enter definition-specific trend keys/series, abnormality interpretation, report abnormal flags, structured biomarker context, score readiness, data confidence, or state scores. Exclusion reasons are stable machine strings such as `incomplete_resolution`, `inactive_revision`, `unreviewed_definition`, `candidate_only_identity`, and `assessment_binding_ineligible`.

Alternative rejected: rely only on route-local `registry_binding_ready` checks. A boolean proves exclusion but does not explain it or prevent future consumers from implementing a weaker gate.

### 6. Metrics are privacy-safe structured events

Emit one structured `resolution_outcome` metric after a new normalization revision is successfully written. Do not emit a second event for an idempotently reused write. The event contains only outcome, mapping band, sorted missing axes, sorted conflict reason codes, write kind, resolver/catalog/compatibility versions, and consumer exclusion reasons. It contains no profile/document/extracted-row identifiers, raw labels, raw values, units, reference ranges, source text, filenames, or candidate keys.

Use the existing application log sink rather than add a patient-linked metrics table. A pure event builder is regression-tested so accidental PHI fields fail a key allowlist assertion.

Alternative rejected: persist one metric row per patient observation. Existing normalization revisions already hold the audited decision; a duplicate event table adds retention and access-control risk without improving the EH-112 product contract.

### 7. Verification follows the four-outcome matrix

Add a dedicated EH-112 verifier with table-driven fixtures for resolved, partial, ambiguous, and unmapped rows. It proves authoritative revision precedence, nullable identity, sanitized details, raw-evidence preservation, labels/guidance, reprocess availability, trend and assessment exclusions, and metric field allowlisting. Existing EH-106/EH-111 consumer and compatibility suites remain regression gates.

## Risks / Trade-offs

- **[Persisted active outcomes can differ from a current-catalog preview]** → Show the active revision as authoritative; label preview-only rows explicitly and never grant consumer eligibility from preview.
- **[Keeping incomplete rows in Biomarkers increases visible row count]** → Give each row a distinct mapping state and a `Needs mapping` filter while excluding it from trend selectors and charts.
- **[Reason codes are technical]** → Map codes to concise English labels in the UI and retain raw codes only in the technical-details contract.
- **[Structured log metrics depend on deployment log aggregation]** → Keep the event deterministic and aggregateable; do not add PHI-bearing persistence solely for metrics.
- **[Existing consumers may bypass the shared projector]** → Migrate every Registry 2.0 laboratory consumer in the same change and add static/runtime regression checks for the eligibility contract.
- **[No per-row retry]** → Keep the document-level action explicit and record row-level reprocessing as EH-116 scope.

## Migration Plan

1. Add the shared outcome/detail, eligibility, and metric event types and pure projectors.
2. Extend active revision reads with persisted confidence, axes/reasons, and version metadata required by the summary.
3. Migrate document detail, document observations, Biomarkers, reports, structured context, and Health Profile to the shared projector.
4. Replace document-review labels and candidate-key rendering with the EH-112 wording and sanitized technical details; keep the existing document reprocess action visible.
5. Add privacy-safe metric emission after successful non-reused normalization writes.
6. Add the four-outcome verifier, update existing consumer regressions, and create `QA/eh-112/checklist.md`.
7. Deploy as an application-only cutover unless implementation discovers a missing persisted field. Rollback reverts the application release; append-only revisions and raw evidence remain valid.

## Open Questions

No implementation-blocking questions remain. EH-115 may later expose a separately authorized, redacted full trace, and EH-116 may add targeted or bulk reprocessing without changing this outcome contract.
