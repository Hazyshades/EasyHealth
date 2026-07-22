## ADDED Requirements

### Requirement: Authenticated signed URL for original file

The system SHALL provide `GET /api/documents/[id]/file` that verifies session ownership, returns a signed URL to the document original (or legacy `storage_path`), and sets `Cache-Control: no-store`. The response SHALL include `url`, `mimeType`, `filename`, and `expiresIn` (900 seconds). The system MUST NOT return raw storage paths to the client.

#### Scenario: Owner downloads original PDF

- **WHEN** an authenticated user requests the file endpoint for their own document
- **THEN** the system returns a signed URL valid for 15 minutes and the correct MIME type

#### Scenario: Unauthorized access denied

- **WHEN** a user requests the file endpoint for a document owned by another profile
- **THEN** the system returns HTTP 401 or 404

### Requirement: Page preview signed URLs

The system SHALL provide `GET /api/documents/[id]/pages/[pageNumber]` returning a signed URL to `pages/page-{n}.webp` when pipeline artifacts exist, plus `width`, `height`, and `pageNumber`.

#### Scenario: Pipeline document page preview

- **WHEN** a document has `page_count` and generated page previews
- **THEN** the page endpoint returns a signed WebP URL for the requested page number

#### Scenario: Legacy document without pages

- **WHEN** a legacy document has no page previews
- **THEN** the page endpoint returns HTTP 404 and the UI falls back to original file display

### Requirement: Thumbnail signed URL

The system SHALL provide `GET /api/documents/[id]/thumbnail` returning a signed URL to `thumb.webp` when available.

#### Scenario: Thumbnail available

- **WHEN** a document has a generated thumbnail
- **THEN** the thumbnail endpoint returns a signed URL with 900 second TTL

### Requirement: In-app document detail page

The system SHALL provide `/app/documents/[id]` with a side-by-side layout: document preview on the left, biomarkers panel on the right. Viewing SHALL NOT require x402 payment.

#### Scenario: Legacy document viewing

- **WHEN** a user opens a legacy completed document without pipeline artifacts
- **THEN** the left panel displays the original file (image inline or PDF via iframe/download) and the right panel lists existing `observations` linked by `document_id`

#### Scenario: Pipeline document viewing

- **WHEN** a user opens a document with generated page previews
- **THEN** the left panel displays page preview images with page navigation and zoom, and the right panel lists extracted biomarkers from `document_extracted_biomarkers`

### Requirement: Download original action

The document detail page SHALL include a "Download original" action that uses the signed URL from the file endpoint to download the source file.

#### Scenario: User downloads original

- **WHEN** the user clicks Download original
- **THEN** the browser downloads the original uploaded file

### Requirement: PDF fallback only

When page previews are unavailable or the user chooses full PDF, the system MAY display the original PDF via iframe or open/download using the signed URL. PDF.js MUST NOT be the primary viewer.

#### Scenario: Full PDF fallback

- **WHEN** page previews are not yet ready but the original is a PDF
- **THEN** the UI shows processing state or offers iframe/download of the signed original URL

### Requirement: Biomarker source navigation without highlight

When a biomarker has `source_page`, clicking it SHALL navigate the preview to that page and display `source_text`. The system MUST NOT render bounding-box highlights in v1.

#### Scenario: Click biomarker with source page

- **WHEN** the user clicks an extracted biomarker with `source_page = 2`
- **THEN** the preview switches to page 2 and shows the associated `source_text`

### Requirement: Clickable documents list

The `/app/documents` list SHALL make each row clickable to open `/app/documents/[id]`. The list SHOULD show thumbnail (when available) and processing status.

#### Scenario: Navigate from list

- **WHEN** the user clicks a document row
- **THEN** the app navigates to the document detail page

### Requirement: Medical disclaimer on viewer

The document detail page SHALL display: "This is not medical advice. Consult a healthcare professional."

#### Scenario: Disclaimer visible

- **WHEN** the document detail page renders
- **THEN** the medical disclaimer is visible to the user
