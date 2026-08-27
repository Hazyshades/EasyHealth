# Health Profile reported results

## Purpose

Define the safe Health Profile and dashboard projection for laboratory results preserved from processed documents before they are eligible for scoring.

## Requirements

### Requirement: Processed reported laboratory rows expose a safe profile state
The authenticated Health Profile projection SHALL expose a `reported_results` summary for profile-owned processed documents. The summary SHALL include `reported_count`, `ready_for_scoring_count`, `needs_document_details_count`, `awaiting_catalog_review_count`, `awaiting_verification_count`, and `source_document_count`. Counts SHALL be non-negative, deterministic for the same snapshot, and derived from current extracted rows and the existing observation/resolution eligibility boundaries.

The profile display state SHALL remain `onboarding` when no profile-owned processed document exists, remain `no_recognized_biomarkers` when processed documents contain no current reported laboratory row, use `reported_but_not_scoreable` when at least one reported row exists and zero rows are ready for scoring, and use `body_map` otherwise. The new state SHALL NOT alter system scores, readiness reasons, freshness, or consumer eligibility.

#### Scenario: No documents remains onboarding
- **WHEN** an authenticated profile has no profile-owned processed documents and no reported laboratory rows
- **THEN** the projection reports `profile_display_state = "onboarding"`
- **AND** `reported_results.reported_count = 0`
- **AND** the projection does not claim that a report was processed

#### Scenario: Processed document without reported laboratory rows remains unrecognized
- **WHEN** a profile-owned document is processed but has no current extracted laboratory row with a raw result
- **THEN** the projection reports `profile_display_state = "no_recognized_biomarkers"`
- **AND** it does not present a reported-result count greater than zero

#### Scenario: Reported rows are preserved but none is score-ready
- **WHEN** a processed profile-owned document has one or more current extracted laboratory rows and no assessment-eligible laboratory input
- **THEN** the projection reports `profile_display_state = "reported_but_not_scoreable"`
- **AND** `reported_results.reported_count` is greater than zero
- **AND** `reported_results.ready_for_scoring_count = 0`
- **AND** the profile does not fabricate a numeric system or overall score

#### Scenario: Mixed resolved and unresolved rows retain body-map coverage
- **WHEN** a profile has at least one score-ready laboratory row and additional reported rows blocked by document details, catalog review, or verification
- **THEN** the projection retains `profile_display_state = "body_map"`
- **AND** the reported-results summary exposes the blocked counts
- **AND** score-ready rows remain subject to the existing complete-group and reviewed-binding rules

### Requirement: Reported-result counts use exclusive safe reason buckets
The summary SHALL classify each current reported row into exactly one readiness bucket: score-ready, needs document details, awaiting catalog review, awaiting user verification, or another existing explicit exclusion such as non-current evidence. A row SHALL NOT be counted as score-ready unless the existing assessment eligibility projection admits it. `axis_not_stated` and `unit_or_value_conflict` SHALL count as needing document details; `no_candidate` and `definition_not_reviewed` SHALL count as awaiting catalog review. The projection SHALL not use a candidate key, inferred specimen, inferred unit, or inferred reference range as a reported identity.

#### Scenario: Missing context is actionable without becoming eligible
- **WHEN** a reported row has a safe resolution blocked by `axis_not_stated` or `unit_or_value_conflict`
- **THEN** it increments `needs_document_details_count`
- **AND** it does not increment `ready_for_scoring_count`
- **AND** the raw row remains available through the document review surface

#### Scenario: Unknown or unreviewed identity is catalog review
- **WHEN** a reported row has `no_candidate` or `definition_not_reviewed`
- **THEN** it increments `awaiting_catalog_review_count`
- **AND** it does not expose a candidate key as a confirmed measurement
- **AND** it remains excluded from Health Profile scoring and other definition-specific consumers

#### Scenario: Verification remains a separate boundary
- **WHEN** a row has a concrete reviewed identity but assessment eligibility is false because verification is required
- **THEN** it increments `awaiting_verification_count`
- **AND** it remains excluded from scoring until the existing verification transition admits it

### Requirement: Profile and dashboard recovery copy is factual and navigable
When `reported_results.reported_count > 0` and `ready_for_scoring_count = 0`, Health Profile SHALL show a `Report found, scoring not ready` notice instead of an unexplained empty body map. The notice SHALL show the reported and ready counts, the applicable reason counts, an authenticated `Review results` link to the existing document review surface, and an optional `Upload a clearer report` action. The notice SHALL state that reported values are preserved but excluded from scoring until safely normalized.

The dashboard health-assessment widget SHALL distinguish no documents, document processing, reported-but-not-scoreable results, and score availability. It SHALL not render `Upload your lab` as the primary explanation when a processed document already has reported rows.

#### Scenario: Profile explains a report with no score-ready rows
- **WHEN** the profile is in `reported_but_not_scoreable`
- **THEN** the page shows `Report found, scoring not ready`
- **AND** it shows the reported count and `0` ready-for-scoring count
- **AND** it provides `Review results` and a clearer-report action
- **AND** it does not present an empty body map as the only explanation

#### Scenario: Dashboard does not ask for a duplicate upload
- **WHEN** the dashboard has a processed document with reported rows and zero score-ready rows
- **THEN** the health-assessment widget shows the reported and ready counts
- **AND** it provides a `Review results` link
- **AND** it does not tell the user to upload a first or missing lab

#### Scenario: Processing remains distinct from a completed unresolved report
- **WHEN** an active document is still processing and no completed reported-result summary is available
- **THEN** the dashboard shows a processing state
- **AND** it does not label the document as having zero recognized results
- **AND** it does not present the report as score-ready

### Requirement: Historical product papercuts remain regression-protected
The release verification for this capability SHALL guard the existing product-facing invariants for document review and Health Profile presentation. `DocumentViewer` SHALL preserve hook order across loading, error, empty, and loaded states; a new batch verification operation SHALL record its executing aggregate state before row processing; unknown-date marker details SHALL use one semantic freshness label and one factual explanation without duplicate date-unavailability copy; and extraction context fields promised by the pipeline contract SHALL be persisted or explicitly absent.

#### Scenario: Review workspace transitions without a hook-order failure
- **WHEN** the document review component transitions from bootstrap loading or error into a loaded payload with batch metadata
- **THEN** it renders without a Rules of Hooks violation
- **AND** all batch and review-derived hooks have a stable call order

#### Scenario: Batch initialization fails closed
- **WHEN** a new batch operation cannot be initialized before row processing
- **THEN** no row verification mutation is accepted
- **AND** a successful operation begins with aggregate status `executing`

#### Scenario: Unknown-date details do not repeat the same explanation
- **WHEN** a marker has freshness status `unknown_date`
- **THEN** the drawer shows a factual date-unavailability explanation and the semantic freshness state
- **AND** the same date-unavailability wording is not rendered twice for that marker

#### Scenario: Prompted evidence cannot disappear at persistence
- **WHEN** the extraction pipeline receives a verbatim context field that is named in its extraction contract
- **THEN** the field is present in the persisted provenance mapping
- **AND** a missing field remains absent or `null`
- **AND** no inferred clinical axis is accepted solely because a prompt or panel heading mentioned it
