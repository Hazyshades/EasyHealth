## ADDED Requirements

### Requirement: Soft refresh for documents list polling

When the documents hub polls for processing updates, the system SHALL update document rows without clearing the list into a full-page loading state and without remounting thumbnail components solely due to the poll cycle.

#### Scenario: Processing poll keeps list visible

- **WHEN** at least one listed document has processing status `processing` and the 10-second poll runs
- **THEN** existing document rows remain visible during the fetch
- **AND** the client does not force a full-list loading placeholder that unmounts the table

#### Scenario: Thumbnail not re-requested on soft poll

- **WHEN** a document row already displays a thumbnail URL from the list payload
- **AND** a soft poll returns the same document with a usable thumbnail URL
- **THEN** the client SHALL NOT issue a new `GET /api/documents/{id}/thumbnail` solely because of that poll

### Requirement: List response may include signed thumbnail URL

`GET /api/documents` SHALL, for each document that has a thumbnail storage path, include a signed `thumbnail_url` (and expiry metadata) when signing succeeds, so the hub can render previews without per-row thumbnail API calls.

#### Scenario: List includes thumbnail URL

- **WHEN** an authenticated user requests the documents list and a document has a generated thumbnail
- **THEN** that document object includes a non-empty `thumbnail_url` suitable for an image `src`
- **AND** the response does not expose raw storage paths

#### Scenario: Thumbnail sign failure degrades gracefully

- **WHEN** signed URL creation fails for one document's thumbnail
- **THEN** the list request still succeeds for other documents
- **AND** that document omits `thumbnail_url` or sets it null
- **AND** the UI may show a generic document icon

### Requirement: Document viewer bootstrap load

Opening a document detail view SHALL load viewer-critical data primarily through a single document detail request that includes metadata, type-specific extracted panels as applicable, biomarker/observation data needed for the right panel, and signed URLs for the original file and the initial page preview when available.

#### Scenario: Single request paints viewer essentials

- **WHEN** a signed-in user opens `/app/documents/{id}` for an owned document with page previews
- **THEN** the client obtains document metadata, right-panel data, and a page or file preview URL without requiring a sequential chain of separate biomarkers, observations, file, and page HTTP calls before first paint of the viewer chrome

#### Scenario: Page navigation does not reload full document

- **WHEN** the user changes the preview page number on a multi-page document
- **THEN** the system loads only the page preview for the new page (or uses cache)
- **AND** does not re-fetch the full document bootstrap payload solely due to the page change

### Requirement: Progressive document open UI

While document viewer data is loading, the system SHALL avoid a multi-stage blocking "Loading document…" that waits on non-essential sequential client waterfalls. After bootstrap completes, the viewer SHALL show available panels; missing optional parts degrade without blocking the whole page indefinitely.

#### Scenario: Failed optional preview

- **WHEN** page preview signed URL is unavailable but document metadata loads
- **THEN** the viewer still shows metadata and the insights/biomarkers panel when present
- **AND** falls back to original file display rules already defined for legacy/no-preview docs

### Requirement: Hot-path session resolution without ensureProfile

Read-oriented document API handlers SHALL resolve the authenticated profile id from the Supabase Auth user without performing a profiles-table ensure/select on every request. Profile row creation remains the responsibility of authentication/onboarding entry paths.

#### Scenario: Document GET uses auth user id

- **WHEN** an authenticated user calls `GET /api/documents` or `GET /api/documents/{id}`
- **THEN** the handler authorizes using the session user id as profile id
- **AND** does not require a successful `ensureProfile` database round-trip as part of that request

### Requirement: Processing poll on document detail is non-destructive

While a document detail view polls for processing completion, the system SHALL refresh status and extraction data without blanking the entire viewer into a full-page loading state on each poll tick.

#### Scenario: Viewer processing poll

- **WHEN** the open document has processing status `processing` and the detail poll interval fires
- **THEN** the viewer remains interactive with last-known content where possible
- **AND** updates status when the refresh returns
