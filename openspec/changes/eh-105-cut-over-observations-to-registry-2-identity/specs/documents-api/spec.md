## ADDED Requirements

### Requirement: Document observation DTO is explicitly typed

`GET /api/documents/:id/observations` and document-detail observation payloads SHALL include `observation_kind`. An instrumental observation returned by these endpoints SHALL identify its instrumental source lineage and SHALL not expose or require a legacy observation biomarker key. Default reads for an instrumental document SHALL return only current source records.

#### Scenario: Instrumental document observations are read

- **WHEN** an authorized owner requests observations for an instrumental document with a current numeric measure
- **THEN** the response identifies the row as `observation_kind = 'instrumental'`
- **AND** includes its source-document and instrumental-source relationship
- **AND** omits superseded source records from the default collection

## MODIFIED Requirements

### Requirement: Viewer bootstrap fields on document detail

`GET /api/documents/[id]` SHALL support loading the document viewer in one response by including, when available and authorized:

- existing document metadata and page descriptors
- type-specific accepted extraction panels already returned today
- extracted biomarkers list when the document uses the laboratory extraction review path (or a clear empty list)
- observations linked to the document, each with explicit `observation_kind`, when needed for the viewer
- only current instrumental observations for an instrumental document unless an explicit audit/history endpoint is requested
- signed `file` object (`url`, `mimeType`, `filename`, `expiresIn`) for the original
- signed `current_page` or `page` preview for page 1 (or requested page via optional `page` query) when previews exist

Existing dedicated endpoints (`/file`, `/pages/{n}`, `/biomarkers`, `/observations`, `/thumbnail`) SHALL remain available for partial updates and downloads.

#### Scenario: Detail includes file and first page signed URLs

- **WHEN** an authenticated owner requests `GET /api/documents/{id}` for a pipeline document with page previews
- **THEN** the response includes document metadata
- **AND** includes a signed original file URL
- **AND** includes a signed URL for the initial page preview when page 1 exists

#### Scenario: Detail includes biomarkers for lab extraction path

- **WHEN** an authenticated owner requests detail for a non-legacy lab document with extracted biomarkers
- **THEN** the detail response includes the extracted biomarkers collection used by the viewer right panel
- **AND** includes linked observations with `observation_kind = 'lab'` when any exist

#### Scenario: Detail includes instrumental observations

- **WHEN** an authenticated owner requests detail for an instrumental document with materialized numeric measures
- **THEN** the response includes current linked observations with `observation_kind = 'instrumental'`
- **AND** does not represent them as laboratory biomarker rows

