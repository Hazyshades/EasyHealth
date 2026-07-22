## MODIFIED Requirements

### Requirement: Provenance copied on acceptance

When an extracted biomarker is accepted into observations, the system SHALL copy available provenance fields onto the observation, including source page, source text, bounding box, confidence, raw name, exact raw value text, raw unit, raw reference text, specimen, modifier, alternate units, value kind/text, source extraction linkage, and extraction processing version. The raw value copy SHALL preserve the source representation rather than reconstructing it from normalized numeric or qualitative fields. `provenance_schema_version` is assigned by the persistence layer and is NOT copied from extraction.

#### Scenario: Accepted observation retains source page

- **WHEN** a user accepts an extracted biomarker that has `source_page` 2
- **THEN** the observation stores source page 2 (or equivalent provenance field)
- **AND** retains `source_extracted_biomarker_id` linkage

#### Scenario: Accepted observation retains exact printed evidence

- **WHEN** a user accepts an extracted biomarker whose raw label, value, unit, and reference text are available
- **THEN** the observation stores all four source representations
- **AND** stores the extraction processing version that produced the extracted row
