## Context

The persisted-decision requirement already says that active normalization revisions must be explained from stored trace data, while rows without a revision may receive an explicitly labelled current preview. The current implementation does not have one read seam: `buildNormalizationReview` invokes `resolveMeasurementDefinition` even when an active revision exists, `projectLaboratoryOutcome` reads the operational `resolver_evidence` shape, and review technical details separately read `resolver_decision_trace`.

The active revision relation is also read through several incomplete shapes. Some selectors omit trace, trace-schema, input-identity, or release fields, and `projectActiveRegistryV2LaboratoryBinding` uses the current Registry catalog to decide whether a persisted key is currently reviewed and conversion-ready. Those current lookups may enrich a historical row, but they must not replace its stored outcome or explanation.

Change A, `prepare-resolver-evidence-identity`, supplies the persisted input hash/version and defines historical restoration. This change consumes those fields; it does not create hashes, re-run the Resolver, or alter reversal/reprocessing behavior.

The status model must use independent axes. `source` describes where the decision came from; `quality` describes whether the available persisted data is complete and internally coherent. In particular, `conflict` is a required quality state and must not be collapsed into `unavailable`.

## Goals / Non-Goals

**Goals:**

- Add one typed persisted-decision reader for active and historical normalization revisions.
- Make active persisted revisions authoritative for outcome, identity, evidence, trace, and release metadata.
- Separate `source` (`persisted`, `preview`, or `none`) from `quality` (`available`, `unavailable`, or `conflict`).
- Preserve conflict when persisted revision fields, operational evidence, technical trace, or version metadata disagree.
- Represent missing legacy trace, unsupported metadata, and unavailable catalog enrichment as unavailable without live Resolver fallback.
- Allow current Resolver evaluation only for explicit no-revision previews and explicit new-evaluation actions.
- Cut all persisted-consumer projections over to the same read seam.
- Keep current Registry lookup as optional enrichment that cannot rewrite historical outcome or trace.
- Preserve raw evidence visibility, downstream fail-closed behavior, security boundaries, and the EH-164 marker invariant.

**Non-Goals:**

- Do not define or implement Resolver input identity generation, reprocessing diff/apply policy, or historical reversal; those belong to Change A.
- Do not change Registry catalog release construction or create a historical catalog snapshot system.
- Do not make a current catalog or Resolver repair malformed historical data.
- Do not change Health Profile admission, numeric scoring, trend behavior, or comparator-marker presentation.
- Do not allow a preview to become a persisted decision or grant definition-specific eligibility.
- Do not remove legacy `resolver_evidence` storage in this change.

## Decisions

### D1 — The read result has independent source and quality axes

The shared reader returns a typed result with:

- `source`: `persisted` for an active stored revision, `preview` for an explicitly requested current evaluation when no active revision exists, or `none` when neither source exists;
- `quality`: `available` when the selected source is complete and coherent, `unavailable` when required historical data is missing/unsupported or optional catalog enrichment cannot be supplied, or `conflict` when persisted fields disagree;
- `notPersisted`: true only for `preview` (and false for persisted/none);
- `qualityCodes`: stable machine-readable reasons, including conflict details where applicable.

`source` and `quality` are not a single enum. A persisted revision can be unavailable or conflicting, and a no-data result is `none`/`unavailable`. A preview is explicitly non-persisted and is never silently promoted to a persisted explanation.

**Alternative rejected:** Keep `persisted`, `preview`, and `legacy_unavailable` as one status enum. It cannot express persisted-but-conflicting data and makes source provenance indistinguishable from data quality.

### D2 — Active revision data is authoritative; current Resolver is preview-only

The reader first selects the active revision through the source-owned relation and does not call `resolveMeasurementDefinition` when one exists. It uses the persisted revision and stored trace/evidence to construct the outcome, technical details, versions, and consumer eligibility inputs.

When there is no active revision, an explicit caller may provide a current Resolver preview. The reader marks it `source = preview`, `notPersisted = true`, and keeps all downstream definition-specific eligibility false. If there is neither an active revision nor an explicit preview, it returns `source = none`, `quality = unavailable`.

Correction, acceptance, and reprocessing paths remain explicit new-evaluation paths and do not use the historical reader to make prospective decisions.

**Alternative rejected:** Always compute a current preview and then prefer stored fields. Even an ignored preview can leak current catalog metadata through fallback fields and makes active reads depend on current Resolver execution.

### D3 — Persisted consistency checks preserve conflict

For an active revision, the reader validates the stored contract without mutating it. At minimum it checks:

- revision outcome against each available operational/technical trace outcome;
- resolved measurement-definition and analyte keys against the trace winning candidate and candidate evidence;
- non-resolved rows do not expose a concrete winning identity;
- technical trace schema matches its schema-version column;
- trace input hash matches the revision input hash, and the Change A identity-format version is carried consistently where present;
- revision release fields agree with the release identifiers stored in the technical trace;
- active source/revision lineage is valid for the observation.

A disagreement produces `quality = conflict` with stable conflict codes and preserves the conflicting stored values for technical inspection. It does not call the current Resolver, choose a winner, downgrade to `unavailable`, or write a repair.

Missing legacy trace, invalid unsupported trace, or missing required historical metadata produces `quality = unavailable` and no live replacement. Operational `resolver_evidence` remains readable for existing projections, but it is not presented as a complete technical trace when the technical trace is absent or invalid.

**Alternative rejected:** Prefer whichever stored field is easiest to parse. That hides corruption and can present an internally inconsistent decision as authoritative.

### D4 — Current Registry data is enrichment, not historical authority

The reader may use the current Registry catalog to obtain display names, conversion metadata, or current binding details keyed by the stored identity. If the key is missing, retired, materially changed, or cannot satisfy current enrichment requirements, the reader keeps the stored outcome/key/trace and reports `quality = unavailable` with a catalog-enrichment code. It does not re-resolve the raw row or replace the stored decision.

Concrete downstream consumers fail closed when the required current binding cannot be established, while raw observation/history remains visible. A catalog drift condition is not automatically a persisted-data conflict; `conflict` is reserved for disagreement among persisted decision data unless a future contract explicitly adds a catalog-drift conflict code.

**Alternative rejected:** Re-run the current Resolver when a stored key is unavailable. That turns a missing historical catalog artifact into a new clinical/mapping decision and violates append-only history.

### D5 — One read seam feeds persisted consumers

The shared reader becomes the only source for active persisted decision details in normalization review, incomplete-outcome serialization, document biomarker details, linked Health Profile observation projection, reports, and structured context. `buildNormalizationReview` calls the live Resolver only to construct an explicit no-active-revision preview. Active revisions never compute a disposable preview for fallback fields.

The API/UI exposes the independent source, quality, persistence flag, quality codes, stored versions, outcome, trace summaries, and conflict details. Existing raw evidence and safe outcome wording remain separate from technical decision metadata. Candidate keys remain non-concrete for incomplete outcomes, and conflict/unavailable quality never creates a concrete identity.

**Alternative rejected:** Let each consumer interpret `resolver_evidence`, `resolver_decision_trace`, and revision columns independently. That recreates divergent historical semantics and makes conflict handling inconsistent.

### D6 — EH-164 remains a read invariant

The reader does not reinterpret comparator/detection-limit markers. Accepted textual markers remain `value: null` and `value_kind: "text"`; they remain factual Health Profile evidence and never become numeric score or trend contributions. An unavailable or conflicting decision read does not remove the marker or fabricate a numeric value.

## Risks / Trade-offs

- **[Legacy trace gaps]** Older revisions may have operational evidence but no canonical technical trace. → Return persisted/unavailable, expose the safe stored outcome where possible, and never generate a replacement trace.
- **[Stored-field disagreement]** Trace and projection fields can diverge after historical corruption or incomplete migrations. → Return persisted/conflict with stable codes and all relevant stored fields; do not repair or choose silently.
- **[Current catalog drift]** A current definition may be missing or no longer reviewed even though the historical revision was valid. → Keep stored decision authoritative, mark enrichment unavailable, and fail closed only for consumers that require current concrete binding.
- **[Preview leakage]** A caller may accidentally pass a preview alongside an active revision. → Active revision selection wins; preview is ignored unless no active revision exists, and the result records `notPersisted` explicitly.
- **[Relation shape drift]** Supabase to-one relations can arrive as an object or array and selectors may omit fields. → Normalize relation cardinality in one reader and centralize the complete revision select shape.
- **[API migration]** Consumers may currently expect the combined trace availability value. → Cut all typed callers to source/quality fields together and update response fixtures; do not preserve a second semantic status enum.
- **[Security boundary]** Technical trace data is profile-scoped and can include candidate identifiers. → Retain existing authenticated ownership checks and allowlisted trace serialization before exposing quality diagnostics.

## Migration Plan

1. Add the complete persisted-revision read shape, typed source/quality result, trace parser, and consistency-code definitions. Include Change A identity/version fields when available.
2. Implement active-revision selection and persisted projection without any live Resolver call. Keep explicit no-revision preview as the only reader preview branch.
3. Cut normalization review, incomplete outcomes, document biomarker details, linked Health Profile reads, reports, and structured context to the shared reader. Replace combined availability semantics with independent source/quality fields.
4. Add focused fixtures for valid persisted data, persisted missing trace, persisted conflicts, catalog enrichment unavailable, explicit preview, no data, and candidate/non-concrete outcomes.
5. Run the existing EH-164 verification and assert that read-quality changes do not remove accepted textual markers or add numeric score/trend contributions.
6. Deploy read changes with the additive Change A metadata already available. Rollback is application-only: revert consumer cutover while leaving persisted rows untouched; do not add a live fallback to explain active historical decisions during rollback.

## Open Questions

- Confirm the final quality-code vocabulary and which missing fields make the entire read `unavailable` versus only one enrichment field unavailable.
- Confirm whether `source = none`/`quality = unavailable` or a nullable read result is the preferred wire shape when no active revision and no preview exist.
- Confirm the exact current-catalog drift checks needed for display metadata versus consumer binding readiness.
- Confirm API fixture updates for every persisted consumer and the UI wording for `persisted/conflict` versus `persisted/unavailable`.
