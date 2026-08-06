## MODIFIED Requirements

### Requirement: Analytes and measurements have explicit reviewed identity

Every measurement definition SHALL reference a registered analyte and SHALL declare specimen, property, scale, timing, method, value kind, unit policy, aliases, lifecycle, maturity, and assessment behavior. Unknown information SHALL be represented explicitly and MUST NOT behave as positive compatibility evidence.

This prohibition SHALL be enforced at the boundary where resolver input is built, not only inside the resolver. An axis value that the source document does not state SHALL be indistinguishable, to the resolver, from an absent axis — it MUST NOT satisfy a compatibility axis, MUST NOT be removed from the missing-axis set, and therefore MUST NOT by itself make a candidate admissible for a concrete resolution.

#### Scenario: Absolute and percentage differential measurements differ

- **WHEN** absolute and percentage neutrophil definitions are loaded
- **THEN** they share the neutrophil analyte
- **AND** remain distinct measurement identities with compatible value kinds and unit families

#### Scenario: Specimen is unknown

- **WHEN** a source does not state specimen and available context cannot prove it
- **THEN** the resolver does not select a serum, plasma, whole-blood, or urine definition solely from prevalence
- **AND** reports the missing specimen in structured evidence

#### Scenario: Prevalence supplied by an upstream model is still prevalence

- **WHEN** an extraction model supplies a specimen derived from which specimen the analyte is usually measured in, rather than from the document
- **THEN** that value MUST NOT satisfy the specimen axis
- **AND** the outcome MUST report the specimen as missing exactly as if the model had supplied nothing

#### Scenario: An unstated axis cannot unlock a concrete resolution

- **WHEN** a candidate would become admissible only because an unstated axis was treated as compatible
- **THEN** the candidate MUST NOT be admissible
- **AND** the outcome MUST be `partial` with the axis reported as missing

#### Scenario: A score-affecting binding requires stated evidence

- **WHEN** a candidate carries a reviewed assessment binding that affects scoring, and its specimen is not stated by the document
- **THEN** the candidate MUST NOT be selected as the concrete measurement
- **AND** no assessment input MAY be derived from it
