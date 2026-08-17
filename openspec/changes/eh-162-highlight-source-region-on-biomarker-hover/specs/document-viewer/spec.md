## MODIFIED Requirements

### Requirement: Source region highlight on the page preview

When a selected result carries a page-coherent exact source region for the
displayed page, the viewer SHALL draw the pinned highlight over every persisted
line rectangle and bring it into view inside the preview container. A separate
preview highlight MAY be shown for an exact same-page row under pointer hover or
keyboard focus. Preview highlighting SHALL never navigate or scroll. Both
variants SHALL stay aligned with the underlying page image at every zoom level
and viewport width, and SHALL be decorative only.

#### Scenario: Selecting a result pins its exact source

- **WHEN** a user explicitly selects a result whose exact source region is on
  page 2
- **THEN** the viewer shows page 2 and draws the pinned highlight over all its
  rectangles
- **AND** the preview container, not the browser window, scrolls the pinned
  region into view

#### Scenario: Hover previews without navigation

- **WHEN** a user hovers or focuses an exact-region row on the displayed page
- **THEN** the viewer draws a temporary preview highlight
- **AND** the current page, selected row, and scroll positions remain unchanged

#### Scenario: Fuzzy and cross-page regions are withheld

- **WHEN** a region has a non-exact match strategy or belongs to another page
- **THEN** no preview or pinned overlay is drawn from that region
- **AND** the source copy reports the page-only fallback

#### Scenario: Highlight stays aligned under zoom and resize

- **WHEN** the user changes zoom or the rendered page image changes size
- **THEN** every rectangle continues to cover the same source text because its
  position is calculated as a percentage of the rendered image wrapper

#### Scenario: Preview image fails to load

- **WHEN** the page image cannot be loaded
- **THEN** no overlay is rendered
- **AND** the existing preview error and retry path is shown

### Requirement: Explicit source provenance states

The viewer SHALL state which provenance is available for the pinned result:
exact region highlighted, page only with the exact region unavailable, or source
page unavailable. Fuzzy, ambiguous, unresolved, legacy, and scanned-document
states SHALL use page-only or document-only copy and SHALL NOT be described as
highlighted.

#### Scenario: Page-only provenance is stated

- **WHEN** a selected result has a source page but no renderable exact region
- **THEN** the viewer navigates only on explicit selection and states that the
  exact region is unavailable

#### Scenario: Missing page is stated

- **WHEN** a selected result has no source page
- **THEN** the viewer states that the source page is unavailable and does not
  change the displayed page

### Requirement: One owner for selection scrolling

A row selection SHALL move at most one scroll container per pane: the review
list brings the selected row into view, and the source pane brings the pinned
highlight into view within its own preview container. Preview intent SHALL NOT
scroll either container. The overlay SHALL NOT call `scrollIntoView`, and no
component SHALL scroll the window in response to hover or selection.

#### Scenario: Hover does not move scroll position

- **WHEN** a reviewer moves across exact same-page rows
- **THEN** the preview appears and disappears without changing either the row
  list or preview scroll position

#### Scenario: Selecting a row does not move the page

- **WHEN** a reviewer explicitly selects a row whose region is on the displayed
  page
- **THEN** the review list and source pane may scroll their own containers
- **AND** the browser window scroll position is unchanged

### Requirement: Page navigation is available wherever page previews exist

The viewer SHALL offer page navigation and zoom whenever rendered page previews
exist, including for PDF documents. Rows whose regions are on another page SHALL
retain an explicit page affordance; hover and focus MUST NOT flip pages.

#### Scenario: A PDF with previews is navigable

- **WHEN** a PDF document has rendered page previews
- **THEN** the viewer shows page previews with page navigation and zoom controls
- **AND** a reviewer can reach a cross-page source through an explicit action
