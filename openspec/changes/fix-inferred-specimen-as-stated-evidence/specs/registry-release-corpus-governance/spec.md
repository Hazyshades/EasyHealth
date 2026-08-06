## ADDED Requirements

### Requirement: Candidate evidence SHALL cover the extraction-to-resolver seam

The candidate-release corpus feeds labels and axes directly to the resolver, which validates resolver behaviour but cannot observe what the extraction layer supplies. Release evidence SHALL therefore additionally assert that no clinical-axis value reaches resolution unless the source document states it. A candidate SHALL NOT be launchable while any current extracted row in the release evidence set carries a concrete axis value absent from that row's own captured provenance.

#### Scenario: Fabricated axis blocks the candidate

- **WHEN** release evidence contains an extracted row whose concrete specimen is absent from its `source_text` and `section_context`
- **THEN** candidate validation fails and the manifest is not launchable

#### Scenario: Resolver-only coverage is not sufficient evidence

- **WHEN** every corpus threshold passes but no check covers the extraction seam
- **THEN** the release evidence is incomplete and the gap is reported rather than treated as coverage

#### Scenario: Corpus retains its direct-resolver rows

- **WHEN** the seam check is added
- **THEN** the existing direct-to-resolver corpus rows and their expected classifications remain unchanged, because they validate a different boundary

### Requirement: Axis-provenance regression fixtures SHALL cover the prevalence case

The regression corpus SHALL include at least one laboratory row whose analyte is conventionally associated with a specimen, presented with no stated specimen, asserting `partial` with the specimen reported missing. It SHALL also include a row whose specimen is stated only by section context, asserting that the axis is satisfied.

#### Scenario: Conventional serum analyte without stated specimen

- **WHEN** the fixture presents a catalytic-activity enzyme with a valid unit and no specimen wording anywhere
- **THEN** the expected classification is `partial` with `specimen` among the missing axes

#### Scenario: Specimen stated by section context only

- **WHEN** the fixture presents a row under a section heading that states the specimen
- **THEN** the specimen axis is satisfied and the row may resolve under the unchanged admissibility guards
