## ADDED Requirements

### Requirement: Soft background refresh of document list

The Documents hub SHALL distinguish initial load (or tab change) from background refresh used to update processing statuses. Background refresh MUST NOT replace the list with a full-page "Loading documents…" state when documents are already displayed.

#### Scenario: Poll while processing without loading flash

- **WHEN** the user is viewing a non-empty documents list and a document is still processing
- **AND** the hub performs its periodic refresh
- **THEN** the list rows stay on screen during the refresh
- **AND** status chips update when new data arrives

### Requirement: Thumbnails prefer list-provided signed URLs

Document list thumbnails SHALL prefer a signed URL supplied on the list item. The hub MUST NOT mount a per-document thumbnail fetch for every visible row when `thumbnail_url` is already present on the list payload.

#### Scenario: Render thumbnail from list payload

- **WHEN** a list item includes `thumbnail_url` and `has_thumbnail` is true
- **THEN** the hub renders that URL as the row preview without calling `GET /api/documents/{id}/thumbnail` on mount

#### Scenario: Fallback when list has no thumbnail URL

- **WHEN** a list item has a thumbnail available but no `thumbnail_url` field
- **THEN** the hub MAY call the thumbnail endpoint once
- **AND** SHOULD cache the result for the signed URL lifetime while the page session is active
