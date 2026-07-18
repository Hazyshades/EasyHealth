## ADDED Requirements

### Requirement: Efficient document open load path

The document detail page SHALL load viewer-critical data without a client-side waterfall of separate metadata, biomarkers, observations, file, and page requests before showing the main viewer. The preferred path is a single detail/bootstrap response; remaining endpoints are for navigation, download, accept, and reprocess.

#### Scenario: Open document uses bootstrap detail

- **WHEN** a user navigates to `/app/documents/{id}`
- **THEN** the viewer issues a primary detail request that supplies metadata and panel data needed for first interactive paint
- **AND** does not require awaiting four or more sequential dependent document API calls before clearing the initial loading state

### Requirement: Page change loads only page preview

Changing the current page in the preview pane SHALL fetch only the page preview for the new page number (unless already cached) and MUST NOT re-run the full document load (metadata + biomarkers + original file) solely because the page index changed.

#### Scenario: User navigates to page 2

- **WHEN** a multi-page document is open on page 1 and the user moves to page 2
- **THEN** the client requests the page-2 preview URL (or uses cache)
- **AND** does not re-request the full document detail bootstrap solely for that navigation

### Requirement: Non-blocking processing refresh on detail

When the open document is still processing, periodic refresh SHALL update processing status and extraction data without replacing the entire viewer with a blocking loading message on every tick.

#### Scenario: Processing document poll on detail

- **WHEN** the document `processing_status` is `processing` and the detail refresh interval fires
- **THEN** the last rendered viewer content remains visible during the refresh
- **AND** status and panels update when new data arrives

### Requirement: Stable route id resolution

The document detail route SHALL resolve the document id without an extra user-visible loading stage that only waits on route params before mounting the viewer.

#### Scenario: Direct navigation to document URL

- **WHEN** the user opens `/app/documents/{id}` directly
- **THEN** the page mounts the document viewer for that id without a separate dedicated "Loading document…" state that exists only to unwrap route params
