## MODIFIED Requirements

### Requirement: Page OCR artifact contract

The system SHALL write one versioned page OCR artifact for every rendered page,
not only the first. When the document has a text layer, the artifact SHALL carry
per-line `blocks` with bounding boxes and SHALL declare `coordinate_space` as
`normalized`, meaning fractions of the page box with the origin at the top-left.
When no text layer is available, the artifact SHALL carry page text without
blocks and the page SHALL retain page-only provenance.

#### Scenario: Every page is indexed with geometry

- **WHEN** a PDF with a text layer is processed
- **THEN** each page has a `document_pages` row with its own `ocr_text` and a
  page OCR artifact containing normalized line blocks
- **AND** the artifact declares `coordinate_space: "normalized"`

#### Scenario: Scanned page degrades to page-only provenance

- **WHEN** a page has no extractable text layer
- **THEN** no block geometry is written for that page
- **AND** observations attributed to it still record a source page

#### Scenario: Worker writes versioned OCR JSON

- **WHEN** OCR completes for a document page
- **THEN** the stored OCR JSON includes `schema_version` and `full_text`
- **AND** may include block-level `bbox` and `confidence` when the engine provides them

#### Scenario: Readers tolerate partial blocks

- **WHEN** OCR JSON has full text but no blocks array
- **THEN** downstream extraction and review still proceed using full text

## ADDED Requirements

### Requirement: Source region contract

The system SHALL accept exactly one shape for `bounding_box` on extracted rows
and observations: a versioned region in normalized page fractions with a 1-based
page and a declared origin. Values in any other coordinate space, with a
non-positive or non-integer page, with non-finite or degenerate geometry, or
extending beyond the page box SHALL be rejected rather than stored. A stored
region's page SHALL equal its row's `source_page`.

#### Scenario: A pixel-space rectangle is rejected

- **WHEN** extraction or a caller supplies a rectangle whose coordinates lie far
  outside the normalized page box
- **THEN** the value is not stored
- **AND** the row keeps page-only provenance

#### Scenario: A region cannot disagree with its row page

- **WHEN** a write attempts to attach a region measured on page 3 to a row whose
  `source_page` is 2
- **THEN** the write is rejected

### Requirement: Extraction page attribution is grounded

Extraction input SHALL announce page boundaries so the model reports
`source_page` from what it reads. The reported page SHALL be treated as a hint:
when the row's `source_text` matches exactly one place in the page index, the
system SHALL use the matched page and record its region; when the match is
ambiguous, absent, or geometrically implausible, the system SHALL keep
page-level provenance and store no region.

#### Scenario: A unique text match corrects a wrong page hint

- **WHEN** an extracted row reports page 1 but its `source_text` matches exactly
  once, on page 2
- **THEN** the row is persisted with source page 2 and a region on page 2

#### Scenario: An ambiguous snippet keeps page-only provenance

- **WHEN** an extracted row's `source_text` occurs on more than one page and not
  uniquely on the hinted page
- **THEN** the row is persisted with a source page and no region

### Requirement: The extraction model is not asked for geometry

The system SHALL NOT request a bounding box from an extraction model. Regions
SHALL be derived from the page index. Any region supplied by a model SHALL pass
the source region contract before it is stored.

#### Scenario: Instrumental extraction requests no rectangle

- **WHEN** an instrumental report is extracted
- **THEN** the prompt requests source page and source text but no bounding box
- **AND** each measure's region is derived from the page index or is null
