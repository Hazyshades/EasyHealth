## MODIFIED Requirements

### Requirement: No bounding-box highlight in v1

The previous v1 prohibition is retired. The UI MAY render a source-region
highlight on a page preview only when the region derives from persisted
positional provenance whose coordinate space is declared, whose origin is
`top-left`, whose page matches the displayed page, and whose match metadata has
`strategy: "exact"`. In every other case the UI MUST fall back to the existing
page-only or document-only provenance state and MUST NOT draw an overlay. Fuzzy
and model-generated geometry may remain persisted as evidence but is not a
visual claim.

#### Scenario: Exact same-page extracted row previews its source

- **WHEN** a pre-acceptance extracted biomarker has an exact region on the
  currently displayed page
- **THEN** the row's pointer hover or keyboard focus previews that region
- **AND** no page navigation, selection change, or layout shift occurs

#### Scenario: Weak or invalid geometry is withheld

- **WHEN** a row has fuzzy, ambiguous, unresolved, model-origin, malformed,
  cross-page, or missing positional provenance
- **THEN** the row shows the existing page-only or document-only state
- **AND** no highlight overlay is rendered

### Requirement: Review rows expose a non-navigating provenance preview

Extracted review rows and authoritative observation fallback rows SHALL use the
same preview interaction. Pointer hover and keyboard focus MAY preview an exact
same-page region after a short enter delay and SHALL clear it immediately on
leave or blur. Preview intent MUST NOT change the selected row, current page,
or scroll position. An explicit click or Enter remains the pin/navigation
operation.

#### Scenario: Keyboard focus matches pointer hover

- **WHEN** a reviewer tabs to a row with exact same-page provenance
- **THEN** the same preview shown by pointer hover is rendered
- **AND** the source description remains available to assistive technology

#### Scenario: Cross-page hover does not navigate

- **WHEN** a reviewer hovers or focuses a row whose exact region belongs to a
  different page
- **THEN** no overlay is rendered and the current page does not change
- **AND** an explicit page affordance remains available for navigation

#### Scenario: Pinned and previewed rows coexist

- **WHEN** row A is pinned and row B is hovered on the displayed page
- **THEN** row A's pinned region remains visible with the stronger visual weight
- **AND** row B's preview region is visible with a distinct dashed/soft visual
  treatment
- **AND** leaving row B restores row A alone

### Requirement: Extracted rows are eligible before acceptance

The review behavior SHALL apply to `document_extracted_biomarkers` rows while
they are awaiting acceptance, not only to observations created after
acceptance. Existing observation fallback rows SHALL use the same validated
provenance adapter and fallback ladder.

#### Scenario: Pre-acceptance row previews without acceptance

- **WHEN** a document is in `extracted-review` mode and a needs-review row has
  exact same-page provenance
- **THEN** hovering or focusing that row previews its region
- **AND** the row remains pre-acceptance until the reviewer explicitly accepts
  it

### Requirement: Source provenance remains accessible without hover

The overlay SHALL be decorative (`aria-hidden="true"` and
`pointer-events: none`). The row SHALL expose the source page, snippet, and
page-only state in its accessible name or description; no provenance fact may
be available only through hover.

#### Scenario: Screen reader receives source description

- **WHEN** a row receives keyboard focus
- **THEN** its source page/snippet description is exposed independently of the
  decorative overlay
