## MODIFIED Requirements

### Requirement: Biomarker source navigation without highlight

When a biomarker has `source_page`, selecting it SHALL navigate the preview to
that page and display `source_text`. Selection SHALL be bidirectional: changing
the preview page SHALL re-anchor the current row to that page. The system MUST
NOT render bounding-box highlights in v1; a row without a recorded
`source_page` SHALL be presented as linked to the document rather than to a
page.

#### Scenario: Click biomarker with source page

- **WHEN** the user clicks an extracted biomarker with `source_page = 2`
- **THEN** the preview switches to page 2 and shows the associated `source_text`
- **AND** that biomarker is marked as the current row

#### Scenario: Page change re-anchors the current row

- **WHEN** the user changes the preview to a page that has extracted results
- **THEN** the first result anchored to that page becomes the current row

#### Scenario: Biomarker without a source page

- **WHEN** the user selects a biomarker whose `source_page` is null
- **THEN** the preview page does not change
- **AND** the viewer states that the result is not linked to a specific page

### Requirement: In-app document detail page

The viewer SHALL render `/app/documents/[id]` as a split-view review workspace:
the document preview on the left and the observation review rail on the right.
The layout SHALL collapse to a single stacked column on small viewports without
horizontal overflow. For legacy documents without rasterized pages the preview
SHALL fall back to the original file (image inline, PDF through an embedded
frame or download) and the rail SHALL list the observations linked by
`document_id`. PDF.js MUST NOT be the primary viewer.

#### Scenario: Open a processed document

- **WHEN** a user opens a document that has rasterized page previews
- **THEN** the page preview and the observation rail are rendered side by side

#### Scenario: Narrow viewport

- **WHEN** the workspace is rendered at a narrow viewport width
- **THEN** the preview and the rail stack vertically and the page does not
  scroll horizontally

### Requirement: Efficient document open load path

The document detail page SHALL load viewer-critical data without a client-side
waterfall of separate metadata, biomarkers, observations, file, and page
requests before showing the main viewer. The preferred path is a single
detail/bootstrap response; remaining endpoints are for navigation, download,
accept, and reprocess. While that request is in flight the viewer SHALL render a
skeleton that preserves the two-pane geometry rather than a bare text message.

#### Scenario: Open document uses bootstrap detail

- **WHEN** a user navigates to `/app/documents/{id}`
- **THEN** the viewer issues a primary detail request that supplies metadata and panel data needed for first interactive paint
- **AND** does not require awaiting four or more sequential dependent document API calls before clearing the initial loading state

#### Scenario: Loading state preserves layout

- **WHEN** the bootstrap request has not resolved yet
- **THEN** placeholder blocks are rendered for both panes and the loading state
  is announced to assistive technology

## ADDED Requirements

### Requirement: Recoverable viewer load and page-preview failures

A failed document bootstrap SHALL render an alert with a retry control that
re-runs the load in place, alongside a link back to the documents list. A failed
page-preview request SHALL be reported inside the document pane with its own
retry control, and MUST NOT unmount or blank the observation rail.

#### Scenario: Retry a failed document load

- **WHEN** the bootstrap request fails and the user activates the retry control
  after the endpoint recovers
- **THEN** the workspace renders without a full page reload

#### Scenario: Page preview failure is contained

- **WHEN** the preview for the requested page cannot be signed or found
- **THEN** the document pane shows the failure and a retry for that page
- **AND** the observation rail remains rendered and interactive
