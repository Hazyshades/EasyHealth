## MODIFIED Requirements

### Requirement: Every document-sourced observation links to a source page

Every observation created from a document extraction SHALL record a 1-based
source page. Observations that are not derived from a document extraction SHALL
NOT be forced to carry one. A source page of zero or a negative value SHALL be
rejected.

#### Scenario: Accepted laboratory observation records its page

- **WHEN** an extracted biomarker is accepted into observations
- **THEN** the observation stores the source page resolved for that extracted row
- **AND** the write is rejected if that page is missing

#### Scenario: Manually entered observation needs no page

- **WHEN** an observation is created without a source extraction or a source
  instrumental measure
- **THEN** it may be stored with no source page

### Requirement: A stored source region is valid and page-coherent

An observation's `bounding_box` SHALL either be absent or satisfy the source
region contract and belong to the observation's own source page. Acceptance
SHALL copy a region only when both conditions hold, and SHALL store page-only
provenance otherwise.

#### Scenario: Acceptance drops an unverifiable region

- **WHEN** an extracted row carries a region whose page disagrees with the row's
  source page
- **THEN** the accepted observation stores the source page and no region

#### Scenario: The database rejects a malformed region

- **WHEN** a write supplies a `bounding_box` that is not a valid source region
- **THEN** the write is rejected rather than stored for later rendering

### Requirement: Provenance is write-once

Source page, source text, and source region SHALL remain immutable once
written. A first write onto a null field SHALL remain permitted so that
page-only provenance can later gain a region only if it was never set.

#### Scenario: A stored region cannot be replaced

- **WHEN** an update tries to change an observation's existing `bounding_box`
- **THEN** the update is rejected

#### Scenario: Provenance schema version identifies the contract

- **WHEN** an observation is written after EH-118
- **THEN** its provenance schema version is `2`
