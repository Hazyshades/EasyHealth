## MODIFIED Requirements

### Requirement: Source region highlight on the page preview

This requirement replaces the v1 requirement "Biomarker source navigation
without highlight", which prohibited bounding-box highlights.

When a selected result carries a source region for the displayed page, the
viewer SHALL draw a highlight over that region on the page preview and bring it
into view. The highlight SHALL stay aligned with the underlying page image at
every zoom level and viewport width, and SHALL be decorative only, with the
textual source description carrying the same information.

#### Scenario: Selecting a result highlights its source

- **WHEN** a user selects a result whose source region is on page 2
- **THEN** the viewer shows page 2 and draws a highlight over the region
- **AND** the highlight is scrolled into view

#### Scenario: Highlight stays aligned under zoom

- **WHEN** the user changes the zoom level or the window width
- **THEN** the highlight continues to cover the same part of the page image

#### Scenario: A region from another page is not drawn

- **WHEN** the displayed page is not the page the region was measured on
- **THEN** no highlight is drawn on the displayed page

### Requirement: Explicit source provenance states

The viewer SHALL state which provenance is available for the selected result:
region highlighted, page only with the exact region unavailable, or source page
unavailable. It SHALL NOT present page-only provenance as if a region existed.

#### Scenario: Page-only provenance is stated

- **WHEN** a selected result has a source page but no region
- **THEN** the viewer navigates to that page and states that the exact region is
  unavailable

#### Scenario: Missing page is stated

- **WHEN** a selected result has no source page
- **THEN** the viewer states that the source page is unavailable and does not
  change the displayed page

### Requirement: One owner for selection scrolling

A row selection SHALL move at most one scroll container per pane: the review
list brings the selected row into view, and the source pane brings the
highlight into view within its own preview container. The highlight SHALL NOT
scroll anything itself, and no component SHALL scroll the window in response to
a selection.

#### Scenario: Selecting a row does not move the page

- **WHEN** a reviewer selects a row whose region is on the displayed page
- **THEN** the review list scrolls the row into view and the preview container
  scrolls the highlight into view
- **AND** the browser window scroll position is unchanged

### Requirement: Page navigation is available wherever page previews exist

The viewer SHALL offer page navigation and zoom whenever rendered page previews
exist, including for PDF documents, so a source page can always be reached.

#### Scenario: A PDF with previews is navigable

- **WHEN** a PDF document has rendered page previews
- **THEN** the viewer shows page previews with page navigation and zoom controls
