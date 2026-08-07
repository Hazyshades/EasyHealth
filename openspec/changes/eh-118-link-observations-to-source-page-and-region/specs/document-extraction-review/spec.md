## MODIFIED Requirements

### Requirement: Review rows expose their source location

This requirement replaces the v1 requirement "No bounding-box highlight in v1".

Every reviewable row SHALL show its source page and whether an exact source
region is available, and SHALL let the reviewer open that source in the page
preview. A row without a source page SHALL say so rather than omitting the
information.

#### Scenario: Extracted row shows page and region availability

- **WHEN** the extracted-results list is displayed
- **THEN** each row shows its source page, marks page-only rows as such, and
  shows the quoted source text when one exists

#### Scenario: Row without a source page is labelled

- **WHEN** a row has no source page
- **THEN** the row states that the source page is unavailable

### Requirement: Authoritative observations expose the same provenance

When the review panel falls back to already-linked observations, those rows
SHALL expose the same source page, region availability, and source navigation as
extracted rows.

#### Scenario: Observation fallback list links to its source

- **WHEN** the panel lists authoritative observations for the document
- **THEN** each row shows its source page and opens that page when selected
- **AND** a row with a valid region highlights it on the page preview

### Requirement: Source provenance is served to the review client

The document and observations endpoints SHALL return source page, source text,
and the validated source region for reviewable rows. A region that fails the
source region contract or disagrees with its row's page SHALL be served as
absent rather than as geometry.

#### Scenario: Observations endpoint returns page provenance

- **WHEN** the client loads authoritative observations for a document
- **THEN** each observation includes its source page, source text, and either a
  valid region or null
