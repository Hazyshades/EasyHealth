# doctor-visit-brief

## ADDED Requirements

### Requirement: Versioned report and evidence contract

A Doctor Visit Brief SHALL be persisted as a versioned structured payload containing report kind, generated-at metadata, detail level, materialized source document IDs, bounded user-selected questions, a server-rendered deterministic `overview`, typed sections, limitations, source snapshots, the mandatory educational disclaimer, and an optional server-generated `extensions.biomarker_dynamics` frozen DTO with period/schema/policy metadata.

#### Scenario: New brief stores a materialized scope

- **WHEN** an authenticated user creates a brief with an explicit document selection or the all-eligible default
- **THEN** the persisted report contains the exact selected document UUID array
- **AND** the payload contains a supported contract version
- **AND** the all-eligible case is not persisted as an implicit `null` scope

#### Scenario: Legacy report is read without fabricated evidence

- **WHEN** a user opens a legacy report whose document scope or contract version is unavailable
- **THEN** the system renders it through a legacy presentation path
- **AND** does not convert filenames into citation identities
- **AND** marks the report unavailable for new sharing or export until revalidated

### Requirement: Bounded user questions and report date range

The report request SHALL accept an optional `questions` array of at most five unique user-selected questions. Each question SHALL be NFC-normalized, trimmed, 1–240 Unicode scalar characters, and free of control characters and line breaks. The server SHALL persist accepted questions as non-factual `clinician_question` claims with `origin: user_selected`; they SHALL remain visibly questions and SHALL NOT become factual claims or model-authored answers. The request MAY include an optional `report_date_range: { start, end }` whose `start` and `end` are canonical `YYYY-MM-DD` UTC calendar dates with `start <= end`. Filtering SHALL compare each authoritative source date by its UTC calendar date, so the entire end date is inclusive. Measurements use observation date and other source kinds use document date; undated sources are excluded. A document enters the materialized scope only when it contributes at least one eligible in-range source (or an in-range document-summary source). Explicit document IDs that are unauthorized or have no eligible in-range source SHALL return a safe validation error, while the all-eligible path SHALL persist only documents with an eligible in-range source. The same persisted question and date-filtered scope SHALL be used by owner detail, share, and export reads.

#### Scenario: User-selected questions remain questions

- **WHEN** an owner submits two valid questions with a report request
- **THEN** the validated payload stores both as `clinician_question` claims with `origin: user_selected`
- **AND** owner detail, an authorized share, and export render the question text as questions without an answer or factual citation requirement

#### Scenario: Invalid question input fails before persistence

- **WHEN** a request contains an empty, overlong, duplicate, multiline, or control-character question
- **THEN** the endpoint returns a safe validation error
- **AND** no report, question claim, or validation envelope is persisted

#### Scenario: Inclusive report date range materializes scope

- **WHEN** an owner submits canonical `YYYY-MM-DD` UTC dates as an inclusive range
- **THEN** sources on either boundary, including a timestamp late on the end calendar date, and between them are eligible, while sources outside the range or without an authoritative date are excluded
- **AND** the persisted `source_document_ids` and source mappings contain no excluded document

#### Scenario: Explicit document conflicts with date range

- **WHEN** an explicit document ID is unauthorized or has no eligible in-range source
- **THEN** the endpoint returns a safe validation error
- **AND** no report or widened scope is persisted

### Requirement: Source-grounded factual claims

Every factual claim in a new brief SHALL reference one or more source IDs from the same report payload. Each source SHALL identify an allowed evidence kind, source row ID, document ID, and display-safe snapshot of the value, unit, range, text, or date when available. The server SHALL persist the source-row identity separately from the public payload so later citation validation does not rely on snapshot text.

#### Scenario: Claim cites an observation and its document

- **WHEN** a generated claim describes a laboratory measurement
- **THEN** the claim contains a citation to a source ID
- **AND** the source identifies the observation and owning document
- **AND** the source snapshot includes the native value, unit, reference range, and observed date when available

#### Scenario: Unknown citation is not persisted as supported

- **WHEN** generated content references a source ID absent from the server-provided source catalog
- **THEN** EH-150 returns `invalid` with `SOURCE_NOT_FOUND` and the validated-report transition persists no report or evidence mapping
- **AND** the unknown identifier is not rendered as a source link or exposed in the response

### Requirement: Missing evidence is explicit

The brief SHALL represent unavailable, undated, incompatible, or excluded evidence as a limitation. It SHALL NOT infer a value, trend, diagnosis, treatment, or urgency instruction from missing data.

#### Scenario: No historical comparison exists

- **WHEN** a section requests a change but the scoped sources contain fewer than two comparable measurements
- **THEN** the brief shows a limitation explaining that a comparison is unavailable
- **AND** it does not label the result as improving or worsening

### Requirement: Doctor-facing brief sections

The brief detail view SHALL render document summary, latest measurements, changes, questions for a clinician, limitations, and a source ledger from the structured contract. Factual section items SHALL expose their citation labels and source snapshots without exposing storage paths.

#### Scenario: Doctor opens a complete brief

- **WHEN** a signed-in owner opens a validated Doctor Visit Brief
- **THEN** the page renders the typed sections and generated-at date
- **AND** each factual item has an inspectable source reference
- **AND** the medical disclaimer is visible

#### Scenario: Brief remains educational

- **WHEN** the brief contains generated questions or change descriptions
- **THEN** the UI presents them as questions or numeric/source-grounded observations
- **AND** it does not present a diagnosis, treatment plan, or medical directive as a report fact

### Requirement: Enforceable educational content policy

Renderable factual claims SHALL use the closed EH-148 template contract: `source_fact_snapshot` accepts only `{ source_id, include_date }`, and `numeric_observation_snapshot` accepts only `{ source_id, include_range }`; the server renderer derives text solely from the cited source snapshot. Factual model input SHALL NOT contain renderable `text`. Only `clinician_question` items may retain model `question_text`, and the UI SHALL render them as questions rather than report facts. A `removed` claim is omitted from persisted/public claims. EH-150 SHALL validate this contract; EH-148 owns template rendering and final presentation.

#### Scenario: Adversarial directive is not published as a fact

- **WHEN** generated content contains a diagnosis, treatment direction, urgency instruction, imperative, or unsupported free-form factual claim
- **THEN** the validator/persistence boundary rejects it or replaces it with a machine-generated limitation
- **AND** the report detail and exports contain no such directive as a report fact

### Requirement: Server-authorized dynamics handoff

`POST /api/reports` MAY accept an optional `biomarker_dynamics_period` object containing canonical `YYYY-MM-DD` UTC calendar `start` and `end` dates, inclusive through the entire end date. The server SHALL validate the range and exact report `source_document_ids` scope, pass only that scope and period to EH-149, and persist the returned scope-constrained frozen DTO extension through EH-148's validated report transition. If the field is omitted, no dynamics extension is persisted. The request SHALL NOT accept a dynamics DTO or raw observations from the client.

#### Scenario: Dynamics period is bound at report creation

- **WHEN** an authenticated owner submits a valid `biomarker_dynamics_period`
- **THEN** EH-149 receives the server-validated period and EH-148 persists its DTO, schema/policy versions, selected period, and generation metadata
- **AND** a later owner/share/export read selects that persisted extension rather than rebuilding observations

#### Scenario: Dynamics period is omitted

- **WHEN** an authenticated owner creates a brief without `biomarker_dynamics_period`
- **THEN** the report contains no dynamics extension
- **AND** export cannot introduce a dynamics DTO that was not persisted at creation

### Requirement: Deterministic report preview

The server SHALL derive `summary_preview` from the persisted report contract's server-rendered `overview`, using the existing bounded preview rule without a second model call. `overview` SHALL be derived from validated typed content and SHALL NOT be an unvalidated free-form factual field.

#### Scenario: Preview uses validated overview

- **WHEN** a report is generated successfully
- **THEN** its `summary_preview` is persisted from the validated `overview`
- **AND** changing or adding an unsafe model field cannot change the preview into a diagnosis, treatment, urgency, or imperative statement

### Requirement: Immutable validation envelope

Every new report SHALL persist `validation_status` (`valid` or `limited`), the non-empty `validation_version` returned unchanged by EH-150 (`eh150.v1` for new reports), and stable EH-150 `validation_issue_codes` in the same transaction as the validated content. EH-150's recognized compatibility set controls owner/share/export reads; retiring a historical version requires the documented release/migration decision. Invalid candidates SHALL not be persisted. Legacy rows MAY lack this envelope and SHALL remain unavailable for new share/export.

#### Scenario: Limited report exposes only safe issue codes

- **WHEN** validation removes unsupported claims but the remaining report is publishable
- **THEN** the report persists `limited` status, validator version, and issue codes internally
- **AND** owner reads expose safe limitations while share/export projections omit internal issue codes and model prose

#### Scenario: Invalid or tampered envelope fails closed

- **WHEN** a candidate has `invalid` status, missing version, unknown issue code, or a persisted envelope inconsistent with the report contract
- **THEN** creation or read validation rejects it
- **AND** EH-151 and EH-153 return a generic unavailable/validation failure without exposing report content

### Requirement: Durable evidence identity mapping

A new report SHALL persist a server-only `report_evidence_sources` mapping keyed by `(report_id, source_id)` to source kind, source row ID, and document ID in the same transaction as the report payload. Citation validation SHALL resolve source references through this mapping, and the mapping SHALL be deleted with its report. The mapping SHALL NOT expose profile IDs, storage paths, bearer credentials, or raw source text.

#### Scenario: Citation resolves after report persistence

- **WHEN** EH-150 validates a persisted claim after the generation request has ended
- **THEN** the validator resolves its source ID through the report-owned mapping and verifies the source row/document remains in the report's immutable scope
- **AND** a payload snapshot alone is never treated as authorization or row identity

### Requirement: Read-time source availability

Owner detail, EH-151 public report, and EH-153 export reads SHALL use the EH-148 `src/lib/report-read.ts` resolver. For a legacy row with missing contract version or null scope, the resolver SHALL return a readable legacy presentation only to the owner and disable share/export; for a new structured row, missing, invalid, unknown-code, or tampered validation metadata SHALL fail closed. When a mapped source row is archived or removed while its parent document remains active, the resolver SHALL preserve the historical snapshot, mark affected claims limited, add `SOURCE_UNAVAILABLE`, deny live/raw-source access, and return the derived read status without rewriting the persisted report payload. When a source document enters `deleting`/tombstoned state, the resolver SHALL invalidate the complete report before reading content; owner, share, and export reads SHALL return generic unavailable and the report SHALL remain marked for final purge.

#### Scenario: Source is archived after publication

- **WHEN** a validated report is read after a cited source row is archived or removed while its parent document remains active
- **THEN** owner, share, and export views show the source-unavailable limitation and historical snapshot
- **AND** no reader can obtain the archived/removed raw source or an unqualified supported claim

#### Scenario: Tombstoned source invalidates the complete report

- **WHEN** a source document enters `deleting`/tombstoned state after a report was generated
- **THEN** owner detail, public share, and export return generic unavailable before reading report content
- **AND** the complete report is marked for final purge rather than rewritten to remove one source

#### Scenario: Legacy owner read does not bypass the resolver

- **WHEN** an owner opens a legacy report with null scope or no contract/validation envelope
- **THEN** the resolver returns the legacy presentation and disables sharing/export
- **AND** EH-151 and EH-153 cannot use the legacy payload as a validated report

### Requirement: Atomic validated report persistence

`POST /api/reports` SHALL delegate creation to one service-only `createValidatedReport` transition. Before LLM work, the transition SHALL capture a non-null exact `source_document_ids` set and each source document's `write_generation`, separately from typed requested scope. It SHALL run EH-150's pure validator against a server-authorized source catalog, obtain any server-generated scope-constrained EH-149 frozen dynamics extension, then call the EH-148-owned `public.create_validated_report` RPC. That `SECURITY DEFINER` RPC SHALL lock every source document in sorted UUID order before report keys, recheck profile ownership, active/not-deleting state, source-row identity, immutable document scope, each captured `write_generation`, claim/source relationships, and dynamics point/document scope, and atomically insert the requested scope, exact actual source-document IDs, validated content, optional dynamics extension, `validation_status`, `validation_version`, `validation_issue_codes`, and `report_evidence_sources`. Direct report DML SHALL be revoked from runtime roles. A parse, mapping, validation, RPC, persistence, tombstone, or generation-drift failure SHALL roll back so no unvalidated or stale report is readable, shareable, or exportable.

#### Scenario: Mapping validation failure rolls back

- **WHEN** the candidate validator result or the `public.create_validated_report` RPC rejects a citation, mapping, scope, or persistence step
- **THEN** the transition returns a safe validation/error result and persists no report, evidence mapping, or shareable validator status
- **AND** a later read cannot observe the rejected candidate

#### Scenario: Tombstone or republish races report persistence

- **WHEN** report context is loaded and a source document is tombstoned or advances `write_generation` before the RPC commits
- **THEN** the fixed-search-path writer rejects the insert after sorted document-first locking and commit-time revalidation
- **AND** no report, summary preview, evidence mapping, or shareable validator status derived from that stale context is committed
