# doctor-visit-brief

## ADDED Requirements

### Requirement: Versioned report and evidence contract

A Doctor Visit Brief SHALL be persisted as a versioned structured payload containing report kind, generated-at metadata, detail level, materialized source document IDs, a server-rendered deterministic `overview`, typed sections, limitations, source snapshots, the mandatory educational disclaimer, and an optional server-generated `extensions.biomarker_dynamics` frozen DTO with period/schema/policy metadata.

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

### Requirement: Source-grounded factual claims

Every factual claim in a new brief SHALL reference one or more source IDs from the same report payload. Each source SHALL identify an allowed evidence kind, source row ID, document ID, and display-safe snapshot of the value, unit, range, text, or date when available. The server SHALL persist the source-row identity separately from the public payload so later citation validation does not rely on snapshot text.

#### Scenario: Claim cites an observation and its document

- **WHEN** a generated claim describes a laboratory measurement
- **THEN** the claim contains a citation to a source ID
- **AND** the source identifies the observation and owning document
- **AND** the source snapshot includes the native value, unit, reference range, and observed date when available

#### Scenario: Unknown citation is not persisted as supported

- **WHEN** generated content references a source ID absent from the server-provided source catalog
- **THEN** the claim is rejected or marked limited before persistence
- **AND** the unknown identifier is not rendered as a source link

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

`POST /api/reports` MAY accept an optional `biomarker_dynamics_period` object containing inclusive UTC `start` and `end` dates. The server SHALL validate the range and exact report `source_document_ids` scope, pass only that scope and period to EH-149, and persist the returned scope-constrained frozen DTO extension through EH-148's validated report transition. If the field is omitted, no dynamics extension is persisted. The request SHALL NOT accept a dynamics DTO or raw observations from the client.

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

Every new report SHALL persist `validation_status` (`valid` or `limited`), a non-empty `validation_version`, and stable EH-150 `validation_issue_codes` in the same transaction as the validated content. Invalid candidates SHALL not be persisted. Legacy rows MAY lack this envelope and SHALL remain unavailable for new share/export.

#### Scenario: Limited report exposes only safe issue codes

- **WHEN** validation removes unsupported claims but the remaining report is publishable
- **THEN** the report persists `limited` status, validator version, and issue codes only
- **AND** owner, share, and export reads expose limitations without source text or model prose in the envelope

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

Owner detail, EH-151 public report, and EH-153 export reads SHALL use the EH-148 `src/lib/report-read.ts` resolver. When a mapped source row or document is archived or deleted after publication, the resolver SHALL preserve the historical snapshot, mark affected claims limited, add `SOURCE_UNAVAILABLE`, deny live/raw-source access, and return the derived read status without rewriting the persisted report payload.

#### Scenario: Source is archived after publication

- **WHEN** a validated report is read after a cited source is archived or deleted
- **THEN** owner, share, and export views show the source-unavailable limitation and historical snapshot
- **AND** no reader can obtain the archived/deleted raw source or an unqualified supported claim

### Requirement: Atomic validated report persistence

`POST /api/reports` SHALL delegate creation to one service-only `createValidatedReport` transition. The transition SHALL run EH-150's pure validator against a server-authorized source catalog, obtain any server-generated scope-constrained EH-149 frozen dynamics extension, then call the EH-148-owned `public.create_validated_report` RPC. That `SECURITY DEFINER` RPC SHALL recheck profile ownership, source-row identity, immutable document scope, claim/source relationships, and dynamics point/document scope, and atomically insert the validated content, optional dynamics extension, `validation_status`, `validation_version`, `validation_issue_codes`, report scope, and `report_evidence_sources`. A parse, mapping, validation, RPC, or persistence failure SHALL roll back so no unvalidated report is readable, shareable, or exportable.

#### Scenario: Mapping validation failure rolls back

- **WHEN** the candidate validator result or the `public.create_validated_report` RPC rejects a citation, mapping, scope, or persistence step
- **THEN** the transition returns a safe validation/error result and persists no report, evidence mapping, or shareable validator status
- **AND** a later read cannot observe the rejected candidate
