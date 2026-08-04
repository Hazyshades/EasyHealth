# Glucose Measurement Resolution Specification

## Purpose

Define the reviewed glucose measurement identities, compatible evidence, unit conversion safety, and candidate-corpus verification boundaries.

## Requirements

### Requirement: Reviewed glucose definitions preserve specimen and timing identity

The Registry 2.0 launch catalog SHALL expose distinct reviewed glucose
measurement definitions for numeric serum, plasma, and whole-blood results;
fasting plasma glucose; post-prandial plasma glucose; and qualitative urine
glucose dipstick results. Each definition SHALL retain its own specimen,
timing, method, value-kind, and assessment-compatibility metadata. The urine
dipstick definition SHALL NOT be a numeric blood glucose conversion or
metabolic assessment input.

#### Scenario: Explicit serum glucose resolves to its serum identity
- **WHEN** a numeric `Glucose` result in `mg/dL` or `mmol/L` carries explicit
  serum evidence
- **THEN** the resolver returns `resolved` with the reviewed serum glucose
  definition and not the plasma or whole-blood definition

#### Scenario: Explicit whole-blood glucose remains distinct
- **WHEN** a numeric glucose result carries explicit whole-blood evidence
- **THEN** the resolver returns the reviewed whole-blood glucose definition
  and does not substitute a serum or plasma identity

#### Scenario: Explicit urine dipstick glucose remains non-numeric
- **WHEN** a qualitative urine glucose dipstick result carries explicit urine
  evidence
- **THEN** the resolver returns the reviewed urine dipstick definition without
  a numeric glucose conversion or metabolic assessment binding

### Requirement: Glucose selection requires compatible explicit evidence

The resolver SHALL select a concrete reviewed glucose definition only when its
specimen, timing/modifier, value kind, and unit evidence are compatible. An
unknown required specimen or timing/modifier SHALL yield `partial` or
`ambiguous` evidence and SHALL NOT invent a serum, plasma, whole-blood, urine,
fasting, or post-prandial identity.

#### Scenario: Generic glucose without specimen remains non-concrete
- **WHEN** a numeric generic glucose label has an otherwise accepted unit but
  no specimen evidence
- **THEN** the resolver preserves the glucose candidates and returns a
  non-concrete outcome with missing-specimen evidence

#### Scenario: Fasting is never inferred from generic glucose
- **WHEN** a numeric glucose result has explicit plasma evidence but no
  fasting or post-prandial timing evidence
- **THEN** the resolver does not select a fasting or post-prandial definition
  and does not add fasting status to the result

#### Scenario: Explicit post-prandial evidence selects only its definition
- **WHEN** a numeric plasma glucose result includes reviewed post-prandial
  timing evidence
- **THEN** the resolver selects the post-prandial plasma definition and rejects
  incompatible fasting candidates

### Requirement: Reviewed glucose unit conversions are context-safe

The registry SHALL allow the reviewed glucose `mg/dL` to `mmol/L` conversion
only for compatible numeric blood glucose definitions. Missing or incompatible
units SHALL prevent a concrete numeric glucose resolution, and qualitative
urine dipstick results SHALL have no numeric conversion policy.

#### Scenario: Numeric blood glucose conversion is available
- **WHEN** a reviewed numeric blood glucose definition with a compatible unit
  is selected
- **THEN** its reviewed `mg/dL` and `mmol/L` conversion metadata is available

#### Scenario: Incompatible unit does not become concrete glucose
- **WHEN** a glucose candidate has a unit outside the reviewed numeric glucose
  unit policy
- **THEN** the resolver records a unit conflict and does not return a concrete
  numeric glucose definition

### Requirement: Candidate evidence covers glucose safety boundaries

The Registry 2.0 candidate corpus and verification runner SHALL contain
de-identified fixtures for every reviewed glucose specimen/timing variant and
for unknown specimen, unknown timing, and incompatible-unit negatives. The
release gate SHALL fail if any fixture gains a false concrete resolution or no
longer matches its expected classification.

#### Scenario: Candidate corpus detects a false concrete selection
- **WHEN** a test resolver forces a generic or incomplete glucose result to a
  concrete reviewed definition
- **THEN** the candidate corpus reports a false concrete resolution and is not
  launchable
