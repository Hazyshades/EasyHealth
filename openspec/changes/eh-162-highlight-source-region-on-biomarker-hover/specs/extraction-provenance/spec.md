## MODIFIED Requirements

### Requirement: Page OCR artifact contract

The system SHALL write one versioned page OCR artifact for every rendered page.
When a page has a text layer, the artifact SHALL carry per-line or per-word
normalized geometry with `coordinate_space: "normalized"`; the geometry SHALL
use the top-left origin convention. When no text layer is available, the
artifact SHALL carry page text without blocks and the page SHALL retain
page-only provenance.

#### Scenario: Every text-layer page is indexed with geometry

- **WHEN** a PDF with a positional text layer is processed
- **THEN** every page has its own OCR artifact with normalized geometry
- **AND** the artifact declares the normalized coordinate space

#### Scenario: Scanned page degrades to page-only provenance

- **WHEN** a page has no extractable positional text layer
- **THEN** no block geometry is written for that page
- **AND** rows attributed to it retain page-only provenance

### Requirement: Versioned source region and match contract

New `bounding_box` values SHALL use a versioned object with
`coordinate_space: "normalized"`, `origin: "top-left"`, a 1-based `page`, a
non-empty `rects` array of normalized rectangles for exact or fuzzy geometry,
and `match` metadata containing `strategy`, `score`, `engine`, and
`resolver_version`. The application and database SHALL reject non-finite,
degenerate, out-of-page, wrong-space, wrong-origin, and page-incoherent
geometry. The reader MAY canonicalize legacy EH-118 payloads, but only
`match.strategy === "exact"` may be rendered.

#### Scenario: Exact geometry is accepted and renderable

- **WHEN** a deterministic positional matcher creates a normalized exact
  region on page 2
- **THEN** the region is persisted with exact match metadata and can be
  rendered only for page 2

#### Scenario: Fuzzy geometry is retained but not rendered

- **WHEN** the matcher finds a unique fuzzy candidate above its diagnostic
  threshold
- **THEN** the candidate geometry and fuzzy score may be persisted
- **AND** review rows expose page-only provenance with no overlay

#### Scenario: Legacy model or malformed geometry is withheld

- **WHEN** a legacy/model-origin, invalid, or page-incoherent region is read
- **THEN** the application serves page-only provenance
- **AND** the renderer receives no usable exact region

### Requirement: Extraction page attribution is grounded

Extraction input SHALL announce page boundaries. The model's `source_page` and
`source_text` SHALL be treated as hints and quotes only. A deterministic
positional index SHALL classify the snippet as exact, fuzzy, ambiguous, or
unresolved; a unique exact match may correct the page hint, while every other
outcome retains a safe page fallback and never produces a renderable region.
The snippet guidance SHALL request the label, value, and printed unit when
present.

#### Scenario: A unique exact text match corrects a wrong page hint

- **WHEN** an extracted row reports page 1 but its labeled value/unit snippet
  matches exactly once on page 2
- **THEN** the row is persisted with source page 2 and exact geometry on page 2

#### Scenario: An ambiguous or fuzzy snippet stays page-only in review

- **WHEN** a snippet has duplicate exact hits or only a fuzzy candidate
- **THEN** the row keeps safe page provenance and any diagnostic match evidence
- **AND** no overlay is rendered

#### Scenario: A multi-line exact snippet keeps line rectangles

- **WHEN** an exact snippet crosses two visual text lines
- **THEN** the persisted region contains separate rectangles for those lines
- **AND** the overlay does not fill the unrelated space between columns

### Requirement: The extraction model is not asked for geometry

The system SHALL NOT request a bounding box from an extraction model. Regions
SHALL be derived from the positional page index. Any legacy model-supplied region
that enters a read or write path SHALL pass the compatibility parser and SHALL
remain non-renderable unless it carries deterministic exact match metadata.

#### Scenario: Instrumental extraction requests no rectangle

- **WHEN** an instrumental report is extracted
- **THEN** the prompt requests source page and source text but no bounding box
- **AND** any stored region is derived from the positional index or is withheld
