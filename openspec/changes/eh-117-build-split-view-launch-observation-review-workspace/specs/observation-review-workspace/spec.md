## ADDED Requirements

### Requirement: Split-view review workspace

The document review route SHALL present the source document and the extracted
or stored observations of that document side by side in a single workspace. The
document pane SHALL occupy the primary column and the observation list the
secondary rail. Both panes SHALL be reachable without leaving the route, and
neither pane SHALL require the other to be dismissed first.

#### Scenario: Both panes are visible on open
- **WHEN** a reviewer opens a laboratory document that has extracted results
- **THEN** the document preview and the observation list are rendered together
- **AND** the observation list reports how many results are matched, incomplete
  and not verified

#### Scenario: Panel mode follows data presence
- **WHEN** the document has current extracted rows
- **THEN** the workspace lists those rows and offers the acceptance action
- **AND** when the document has no extracted rows but has linked observations
  the workspace lists the observations through the same row presentation

### Requirement: Rows are grouped by source page

The observation list SHALL group rows by the source page recorded for each row.
Groups SHALL be ordered by ascending page number, and rows whose source page was
not recorded SHALL be collected into a final group labelled as such. Each group
SHALL state its page and its row count, and SHALL offer a control that moves the
document pane to that page.

#### Scenario: Groups mirror the document
- **WHEN** results were extracted from pages 1 and 2 and one result has no
  recorded page
- **THEN** the list shows a `Page 1` group, a `Page 2` group, and a
  `Source page not recorded` group in that order

#### Scenario: Group header navigates the preview
- **WHEN** the reviewer activates the page control on a group that is not the
  page currently shown
- **THEN** the document pane navigates to that page

### Requirement: Selected-row synchronization is bidirectional

Selecting a row SHALL mark that row as current and, when the row has a recorded
source page, SHALL navigate the document pane to that page. Changing the page in
the document pane SHALL keep the current selection when that row belongs to the
newly visible page, SHALL otherwise select the first row anchored to that page,
and SHALL otherwise leave the selection unchanged. Selection resolution SHALL be
idempotent so that synchronization cannot oscillate. The current row SHALL be
visually distinguished, exposed as the current item to assistive technology, and
scrolled into view when the selection changes.

#### Scenario: Row selection drives the document pane
- **WHEN** the reviewer selects a row whose source page is 2 while page 1 is
  shown
- **THEN** the document pane navigates to page 2
- **AND** the selected row is marked as the current row

#### Scenario: Page navigation drives the selection
- **WHEN** the reviewer navigates the document pane back to page 1
- **THEN** the first row anchored to page 1 becomes the current row

#### Scenario: A page without rows keeps the selection
- **WHEN** the reviewer navigates to a page that has no extracted results
- **THEN** the current selection is retained and no row is silently cleared

#### Scenario: Rows without a page stay selectable
- **WHEN** the reviewer selects a row whose source page was not recorded
- **THEN** the row becomes the current row and the document pane does not change
  page

### Requirement: Source provenance degrades to page level

Every row SHALL carry a source-location descriptor whose precision is one of
`region`, `page` or `document`. A row with a positive recorded source page SHALL
report `page` precision; every other row SHALL report `document` precision. The
workspace SHALL render the source page and the recorded source text snippet for
the current row and MUST NOT draw a bounding-box highlight over the page
preview. `region` precision is reserved for a later change and SHALL NOT be
produced until reliable bounding boxes exist.

#### Scenario: Page-level provenance is shown for the current row
- **WHEN** a row with source page 2 and a source snippet becomes current
- **THEN** the document pane shows `Page 2` together with the recorded snippet
- **AND** no highlight rectangle is drawn on the page preview

#### Scenario: Document-level provenance is stated, not hidden
- **WHEN** a row has no recorded source page
- **THEN** the workspace states that the result is linked to the document but
  not to a specific page

### Requirement: Workspace loading and error states are recoverable

The initial load SHALL render a two-pane skeleton that preserves the workspace
geometry rather than replacing the route with a bare message. A failed document
load SHALL render an alert with a retry control that re-runs the load and a link
back to the documents list. A failed page-preview request SHALL be reported
inside the document pane with its own retry control and MUST NOT blank or
unmount the observation list. A review-data failure SHALL be announced as an
alert.

#### Scenario: Initial load shows a two-pane skeleton
- **WHEN** the bootstrap request for a document is still in flight
- **THEN** the workspace renders placeholder blocks for both panes and announces
  that the review workspace is loading

#### Scenario: A failed load can be retried in place
- **WHEN** the bootstrap request fails
- **THEN** an alert is shown with a retry control
- **AND** activating retry after the endpoint recovers renders the workspace
  without a full page reload

#### Scenario: A failed page preview keeps the review pane usable
- **WHEN** the preview for the requested page cannot be loaded
- **THEN** the document pane reports the failure and offers to retry that page
- **AND** the observation list remains rendered and interactive

### Requirement: Responsive workspace layout

The workspace SHALL render as two columns on large viewports and SHALL stack
into a single column on small viewports without introducing horizontal page
overflow. Each pane SHALL manage its own scrolling so that neither pane forces
the other to scroll.

#### Scenario: Small viewport stacks the panes
- **WHEN** the workspace is rendered at a narrow viewport width
- **THEN** the document pane and the observation list are stacked in one column
- **AND** the page does not scroll horizontally
