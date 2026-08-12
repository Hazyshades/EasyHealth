## ADDED Requirements

### Requirement: Page-only provenance accepts a nullable source region

When a document-sourced laboratory result has a valid positive `source_page` but no usable source region, the acceptance writer SHALL persist the observation with that source page and a SQL `NULL` `bounding_box`. The writer or RPC SHALL treat both an omitted `bounding_box` property and an explicit JSON `null` as absent provenance. A non-null source-region value SHALL continue through the existing EH-118 contract and SHALL NOT be silently converted to page-only provenance when it is malformed or belongs to another page.

#### Scenario: Explicit JSON null creates page-only observation

- **WHEN** the writer submits an extracted laboratory result with `source_page = 1` and `bounding_box = null` in its JSON observation payload
- **THEN** the acceptance transaction creates one linked observation with `source_page = 1` and SQL `bounding_box IS NULL`
- **AND** the active normalization revision is committed according to the existing acceptance outcome rules

#### Scenario: Omitted region creates page-only observation

- **WHEN** a compatible caller omits the `bounding_box` property while supplying a valid document source page
- **THEN** the acceptance transaction treats the region as SQL `NULL` and preserves the source-page linkage

#### Scenario: Invalid populated region remains rejected

- **WHEN** the writer supplies a non-null region that has invalid geometry, an unsupported shape, or a page different from `source_page`
- **THEN** the database rejects the transaction through the existing provenance constraint
- **AND** no source-only observation or unlinked active revision remains committed
