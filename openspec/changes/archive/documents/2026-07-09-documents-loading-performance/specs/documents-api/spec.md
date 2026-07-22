## ADDED Requirements

### Requirement: Signed thumbnail URL on list items

`GET /api/documents` SHALL include `thumbnail_url` and `thumbnail_expires_in` (seconds) on each document that has `thumbnail_storage_path` when a signed URL can be created. The system MUST NOT return raw storage paths. Documents without thumbnails omit the URL fields or set them null.

#### Scenario: List item with thumbnail

- **WHEN** an authenticated user lists documents and a document has `thumbnail_storage_path` set
- **THEN** the corresponding list item includes a signed `thumbnail_url`
- **AND** includes `thumbnail_expires_in` consistent with the signed URL TTL policy

#### Scenario: List remains available if one sign fails

- **WHEN** signed URL creation fails for a subset of thumbnails
- **THEN** the list endpoint still returns HTTP 200 with the documents array
- **AND** failed items simply lack `thumbnail_url`

### Requirement: Viewer bootstrap fields on document detail

`GET /api/documents/[id]` SHALL support loading the document viewer in one response by including, when available and authorized:

- existing document metadata and page descriptors
- type-specific accepted extraction panels already returned today
- extracted biomarkers list when the document uses the extraction review path (or a clear empty list)
- observations linked to the document when needed for legacy/lab display
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
- **THEN** the response includes the extracted biomarkers collection used by the viewer right panel
- **AND** includes observations for that document when any exist

### Requirement: Efficient session resolution for document GETs

Document read endpoints SHALL resolve the caller profile id from the authenticated Supabase user id without invoking profile ensure/upsert logic on each request.

#### Scenario: List authorized without ensureProfile

- **WHEN** a valid session user calls `GET /api/documents`
- **THEN** authorization succeeds using the auth user id as profile id without a mandatory profiles ensure query in that request path
