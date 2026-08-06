## MODIFIED Requirements

### Requirement: Extracted biomarker provenance fields

Each extracted biomarker row SHALL capture provenance when available: raw name, numeric and/or text value, unit, reference range text, source page, source text snippet, bounding box, confidence, specimen, modifier, and optional alternate reported unit pair.

Provenance SHALL record what the source document states. A clinical-axis value — specimen, modifier, method or timing — SHALL be stored as a concrete value only when it is **stated**, meaning its lexical form occurs in provenance already captured for that row: the row's own `source_text`, or the `section_context` under which the row was printed. An axis the extraction model supplied without such evidence SHALL be stored as the explicit unknown value for that axis, never as a concrete one.

#### Scenario: Quantitative extract with page snippet

- **WHEN** a lab line is extracted with a visible page number and snippet
- **THEN** `source_page` and `source_text` are stored on the extracted biomarker row
- **AND** `value_numeric` is set for quantitative results

#### Scenario: Qualitative extract uses value_text

- **WHEN** a lab line is qualitative (for example `Negative`)
- **THEN** the extracted row stores `value_text` and does not require `value_numeric`

#### Scenario: Dual-unit line

- **WHEN** the lab prints both conventional and SI on one line
- **THEN** the system stores one primary value/unit and MAY store alternate reported value/unit fields
- **AND** does not create two extracted rows solely for dual-unit printing

#### Scenario: Model supplies a specimen the document never states

- **WHEN** the extraction model returns `specimen: "serum"` for a row whose `source_text` and `section_context` contain no specimen wording
- **THEN** the stored row records the specimen as unspecified
- **AND** the row is not stored as if the document stated serum

#### Scenario: Section context states the specimen

- **WHEN** a row is printed under a section whose captured `section_context` contains the specimen wording, for example a serum chemistry heading
- **THEN** the specimen is stated and MAY be stored as that concrete value

#### Scenario: Axis stated in the row's own snippet

- **WHEN** a row's `source_text` itself contains the axis wording, for example `Neutrophils, absolute (NEU)` for an absolute modifier
- **THEN** that axis remains a concrete stored value

## ADDED Requirements

### Requirement: Unstated axes SHALL NOT reach the resolver as stated evidence

The projection that builds resolver input from an extracted row SHALL drop any concrete clinical-axis value that is not stated by that row's captured provenance, and SHALL present the axis as absent instead. This SHALL hold for every caller of the projection, including the review preview and reprocessing, so that rows already stored with a fabricated axis are corrected on read rather than depending on re-extraction.

#### Scenario: Existing fabricated row is corrected on read

- **WHEN** a row stored before this change carries a concrete specimen its provenance does not state, and it is resolved or previewed
- **THEN** the resolver receives no specimen for that row
- **AND** the outcome reports the missing specimen axis

#### Scenario: Reprocessing does not reinstate the inference

- **WHEN** a reprocessing batch re-resolves such a row
- **THEN** the fabricated axis is not used, because reprocessing re-runs resolution and not extraction

#### Scenario: Stated axis survives the projection

- **WHEN** a row's provenance states the specimen
- **THEN** the projection forwards it unchanged and the axis can be satisfied

### Requirement: Stored axis provenance SHALL be verifiable by a static check

The system SHALL provide a check that fails when any current extracted row carries a concrete clinical-axis value absent from that row's own captured provenance. The check SHALL name the offending rows and axes, and SHALL be runnable against a document without re-running extraction.

#### Scenario: Fabricated axis is detected

- **WHEN** the check runs over a document whose rows carry a specimen absent from their provenance
- **THEN** the check fails and reports the affected row count and axis

#### Scenario: Clean document passes

- **WHEN** every concrete axis on every current row is stated by its provenance
- **THEN** the check passes
