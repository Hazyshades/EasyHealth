## ADDED Requirements

### Requirement: Extracted biomarkers staging table

The system SHALL store pipeline extraction results in `document_extracted_biomarkers` with fields including: `biomarker_key`, `biomarker_name`, `raw_name`, `value_numeric`, `value_text`, `unit`, `reference_range`, `collected_at`, `reported_at`, `source_page`, `source_text`, `bounding_box` (nullable JSON, unused in v1 UI), `confidence`, `extraction_method`, `status`, `processing_version`, `extraction_model`.

#### Scenario: Worker writes extracted rows

- **WHEN** the extraction step completes
- **THEN** one row per detected biomarker exists linked to `document_id` and `profile_id`

### Requirement: All extractions start as needs_review

The worker MUST set `status = 'needs_review'` for every newly extracted biomarker row. The system MUST NOT auto-accept or auto-write to `observations` in v1.

#### Scenario: New extraction default status

- **WHEN** the worker inserts extracted biomarker rows
- **THEN** each row has `status = 'needs_review'`

### Requirement: Extraction metadata

Each extracted biomarker row SHALL record `processing_version` (pipeline version string) and `extraction_model` (LLM model identifier used). The parent `documents` row SHALL also store document-level `processing_version` and `extraction_model`.

#### Scenario: Metadata recorded on extraction

- **WHEN** extraction completes
- **THEN** extracted rows and the document record include processing version and model metadata

### Requirement: List extracted biomarkers API

The system SHALL provide `GET /api/documents/[id]/biomarkers` returning extracted biomarkers for the document with status, confidence, source fields, and values.

#### Scenario: Owner fetches extracted biomarkers

- **WHEN** an authenticated owner requests biomarkers for their document
- **THEN** the API returns all `document_extracted_biomarkers` rows for that document

### Requirement: Accept biomarkers API

The system SHALL provide `POST /api/documents/[id]/biomarkers/accept` accepting `{ ids: string[] }`. For each accepted row, the system SHALL upsert an `observations` record and set `observations.source_extracted_biomarker_id` to the accepted row id. Accepted rows SHALL be marked `status = 'accepted'`.

#### Scenario: User accepts selected biomarkers

- **WHEN** the user accepts two extracted biomarker ids
- **THEN** two `observations` rows are created or updated with provenance links and the extracted rows are marked accepted

### Requirement: Legacy documents show observations

For documents without `document_extracted_biomarkers` (legacy completed uploads), the biomarkers panel SHALL display existing `observations` where `document_id` matches, without accept/reject actions.

#### Scenario: Legacy biomarkers display

- **WHEN** a user opens a legacy document with existing observations
- **THEN** the right panel lists observations linked to that document

### Requirement: Reprocess deferred

The reprocess action (`POST /api/documents/[id]/reprocess`) is out of scope for initial implementation phases. Legacy documents SHALL NOT require reprocess to be viewable.

#### Scenario: Legacy doc viewable without reprocess

- **WHEN** a legacy document exists with observations but no pipeline artifacts
- **THEN** the user can view the document and observations without reprocessing

### Requirement: No bounding-box highlight in v1

The UI MUST NOT render highlight overlays on page previews until OCR provides reliable bounding boxes in a future change. Clicking a biomarker SHALL navigate to `source_page` and show `source_text` only.

#### Scenario: No highlight overlay rendered

- **WHEN** a biomarker has a null or populated `bounding_box`
- **THEN** the viewer does not draw a highlight rectangle in v1

### Requirement: Medical safety on extraction outputs

Extracted and accepted biomarkers displayed in the UI SHALL use educational language only. The panel SHALL include the standard medical disclaimer.

#### Scenario: Disclaimer on biomarkers panel

- **WHEN** the biomarkers panel renders on the document detail page
- **THEN** the medical disclaimer is shown
