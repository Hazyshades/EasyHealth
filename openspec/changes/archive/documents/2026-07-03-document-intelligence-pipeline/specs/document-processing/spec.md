## ADDED Requirements

### Requirement: Processing jobs table

The system SHALL maintain `document_processing_jobs` with fields: `document_id`, `profile_id`, `job_type`, `status` (`queued`, `processing`, `completed`, `failed`), `attempts`, `max_attempts` (default 3), `error`, timestamps.

#### Scenario: Job created on upload

- **WHEN** a document upload completes
- **THEN** a `full_pipeline` job exists with `status = 'queued'`

### Requirement: Background worker processes jobs

A separate Node.js worker (not Next.js API routes or Supabase Edge Functions) SHALL poll queued jobs, lock a job, download the original via service role, generate artifacts, and update document status.

#### Scenario: Worker completes preview generation

- **WHEN** the worker processes a PDF with 2 pages
- **THEN** `thumb.webp`, `pages/page-1.webp`, `pages/page-2.webp` are uploaded and `document_pages` rows are created

### Requirement: Page preview generation

The worker SHALL generate WebP page previews (width 1400–1800px, quality 80–90) using sharp and poppler `pdftoppm` for PDFs, or sharp normalization for images.

#### Scenario: Image upload single page

- **WHEN** the worker processes a JPEG upload
- **THEN** one page preview and one thumbnail are generated

### Requirement: OCR text storage v1

The worker SHALL extract text via poppler `pdftotext` for digital PDFs and store `ocr/fulltext.txt`. For scanned content, the worker MAY rely on LLM vision during extraction without cloud OCR vendors.

#### Scenario: Digital PDF text extracted

- **WHEN** the worker processes a text-based PDF
- **THEN** `ocr/fulltext.txt` is stored in the document storage prefix

### Requirement: Processing status lifecycle

The `documents` table SHALL track `processing_status` with values exposed to UI: `processing`, `needs_review`, `ready`, `failed`, plus `processing_error`, `page_count`, `mime_type`, `file_size_bytes`, `processing_version`, `processed_at`.

#### Scenario: Pipeline completes with biomarkers

- **WHEN** extraction finishes with one or more biomarkers
- **THEN** `processing_status` is set to `needs_review`

#### Scenario: Pipeline fails

- **WHEN** the worker exhausts retries
- **THEN** `processing_status` is `failed` and `processing_error` is populated

### Requirement: No cloud OCR in v1

The worker MUST NOT integrate Google Document AI or AWS Textract in v1.

#### Scenario: No Textract calls

- **WHEN** the worker runs the full pipeline
- **THEN** no requests are made to Document AI or Textract APIs

### Requirement: Storage artifact layout for new documents

New uploads SHALL use storage prefix `{profileId}/{documentId}/` with `original.*`, `thumb.webp`, `pages/page-{n}.webp`, `ocr/fulltext.txt`, and `extraction/biomarkers.json`.

#### Scenario: Artifacts under document prefix

- **WHEN** processing completes for a new document
- **THEN** all artifacts reside under the document-specific storage prefix
