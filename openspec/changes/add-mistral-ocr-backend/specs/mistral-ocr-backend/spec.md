## ADDED Requirements

### Requirement: OCR selection SHALL be deterministic and provider-neutral

The document worker SHALL expose OCR results through an EasyHealth-owned contract and SHALL select exactly one production OCR source per processing attempt. A complete digital PDF with matching rendered/page-index counts, usable local text on every non-blank page, and complete page-marked text above the existing extraction threshold SHALL use Poppler. An image, scanned PDF, incomplete text layer, or failed local-coherence check SHALL use one complete Mistral OCR request when enabled.

#### Scenario: Complete digital PDF keeps Poppler

- **WHEN** a PDF has matching rendered and Poppler page counts, usable local text for every non-blank rendered page, and page-marked text above the extraction threshold
- **THEN** the worker SHALL not call Mistral
- **AND** the normalized OCR source SHALL be `pdf_text_layer`
- **AND** existing exact Poppler source-region behavior SHALL remain available

#### Scenario: Scanned multi-page PDF uses one complete request

- **WHEN** a two-page PDF has no usable local text and Mistral OCR is enabled
- **THEN** the worker SHALL send the complete original PDF once as an in-memory Base64 request
- **AND** both validated pages SHALL flow through the existing page-marked text extraction pipeline
- **AND** the worker SHALL not send only page 1 to the downstream vision extractor

#### Scenario: Image input uses Mistral when enabled

- **WHEN** a JPEG, PNG, or AVIF document is processed with Mistral OCR enabled
- **THEN** the worker SHALL send the image as a Base64 data URL with image MIME type
- **AND** the resulting one-based page text SHALL flow through the existing classifier and document-type extractor

#### Scenario: Disabled OCR has explicit legacy behavior

- **WHEN** a scan or image is processed while Mistral OCR is disabled
- **THEN** development/test configuration MAY select the explicit legacy vision path
- **AND** production SHALL report OCR coverage unavailable rather than silently completing a multi-page document from page 1

### Requirement: Mistral requests SHALL be stateless and privacy-safe

The worker SHALL use the official Mistral SDK against only the configured `eu` or `us` regional endpoint, send the private document as an in-memory Base64 data URL to `/v1/ocr`, and SHALL NOT use public URLs, Files, Libraries, or Batch for patient documents. Mistral credentials SHALL remain worker-only.

#### Scenario: Regional configuration is invalid

- **WHEN** Mistral OCR is enabled without an API key, with an unsupported region/model, or with invalid limits
- **THEN** worker startup SHALL fail with a configuration error before a job is claimed
- **AND** no global endpoint fallback SHALL be attempted

#### Scenario: Provider model is not available in the selected region

- **WHEN** deployment startup verifies the configured model against the selected regional `models.list` response and the model is absent
- **THEN** startup SHALL fail
- **AND** the worker SHALL not reroute the request to a different endpoint

### Requirement: OCR responses SHALL be validated and normalized

The adapter SHALL validate untrusted responses locally and return an `OcrDocument` containing provider, engine, model, source SHA-256, one-based page numbers, Markdown/plain text, dimensions, block confidence, and page usage. External zero-based indexes SHALL be normalized by validated response array order. Missing, duplicate, out-of-range, malformed, or page-mismatched data SHALL fail closed.

#### Scenario: Valid multi-page response is normalized

- **WHEN** Mistral returns a complete ordered page array with valid Markdown and dimensions
- **THEN** the adapter SHALL produce contiguous one-based EasyHealth pages
- **AND** page usage SHALL record the provider-reported processed-page count when valid
- **AND** no Mistral SDK type SHALL escape the adapter boundary

#### Scenario: Invalid block geometry is rejected

- **WHEN** a block has missing dimensions, non-finite/negative coordinates, an inverted rectangle, or a rectangle outside the page
- **THEN** that geometry SHALL not be persisted as a source region
- **AND** the attempt SHALL fail with a stable `ocr_invalid_response` or `ocr_page_mismatch` code as applicable

### Requirement: OCR artifacts SHALL be versioned and attempt-scoped

The worker SHALL write immutable OCR/page artifacts below the processing-attempt prefix and SHALL produce Page OCR schema v2 for Mistral while continuing to read schema-v1 artifacts. Every successful artifact SHALL retain source hash, provider/model/engine, page number, text, dimensions, block metadata, coordinate space, and creation time.

#### Scenario: Failed attempt preserves the prior current artifact set

- **WHEN** a replacement OCR response, extraction, or finalization fails after the prior document has a current page set
- **THEN** the prior current page/thumbnail/OCR paths SHALL remain readable
- **AND** replacement rows/artifacts SHALL remain non-current or non-published and SHALL not be mixed into the current set

#### Scenario: Successful attempt promotes one coherent page set

- **WHEN** all replacement pages and extraction evidence are complete and the processing attempt commits successfully
- **THEN** the new attempt's page rows and typed extraction rows SHALL become current/published in the same database transaction as document/job/attempt completion
- **AND** the prior page set SHALL cease to be current without deleting immutable audit evidence

### Requirement: OCR provenance SHALL remain downstream-review-only

Mistral OCR SHALL provide transcription and coarse structure only. Normalized text SHALL use the existing document-type parsers and existing Registry 2.0 resolver boundaries. Mistral blocks, table boxes, and OCR confidence SHALL NOT directly create exact biomarker regions, measurement definitions, resolver outcomes, verified observations, or Health Profile contributions.

#### Scenario: Coarse table geometry is persisted without a false overlay

- **WHEN** a Mistral response contains a whole-table block or geometry that cannot be matched to one exact page-coherent snippet
- **THEN** the block MAY remain in the OCR artifact as coarse metadata
- **AND** the extracted row SHALL degrade to page-only provenance
- **AND** EH-162 SHALL draw no exact overlay

#### Scenario: Mistral extraction remains human review-only

- **WHEN** an extracted laboratory row has `source_text_origin=mistral_ocr` and no approved OCR release hash
- **THEN** the row SHALL remain `needs_review`
- **AND** automatic verification SHALL not be called
- **AND** the row SHALL not contribute to Health Profile scoring

### Requirement: OCR telemetry SHALL contain only safe operational fields

The worker SHALL record at most one stage-`ocr` invocation event per provider call with provider/model/region, input byte count, pages, latency, success, stable error code, processing attempt ID, request ID when available, and estimated page cost. OCR request/response bodies, Base64, document text, patient identifiers, lab values, and raw provider errors SHALL not enter logs, telemetry, or `processing_error`.

#### Scenario: Successful invocation is logged safely

- **WHEN** a Mistral OCR call succeeds
- **THEN** telemetry SHALL include the configured provider/model/region, byte/page counts, latency, attempt ID, and page cost
- **AND** telemetry SHALL not include Markdown, Base64, source snippets, or patient identifiers

#### Scenario: Provider failure maps to a stable code

- **WHEN** authentication, a 4xx/429, timeout, 5xx, malformed JSON, or page mismatch occurs
- **THEN** the worker SHALL persist only the corresponding stable privacy-safe error code
- **AND** retry/reclaim behavior SHALL preserve the prior current result
