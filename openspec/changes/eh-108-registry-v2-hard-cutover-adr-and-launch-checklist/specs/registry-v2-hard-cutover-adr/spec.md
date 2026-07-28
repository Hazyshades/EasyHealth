## ADDED Requirements

### Requirement: Canonical hard-cutover ADR exists under registry/
The project SHALL publish a stable architecture decision record at
`registry/adr/0001-registry-v2-hard-cutover.md` that documents why EasyHealth
uses one pre-launch Registry 2.0 runtime and rejects dual-runtime /
feature-flag rollback to Registry v1.

#### Scenario: Engineer reads the decision
- **WHEN** an engineer opens `registry/adr/0001-registry-v2-hard-cutover.md`
- **THEN** the ADR states Status/Date, the single-runtime decision, the
  rejected dual-runtime alternative, consequences, and forward-only rollback
  policy

### Requirement: ADR includes Mermaid logical and physical schema
The ADR SHALL include a Mermaid diagram for logical and physical ownership
covering `Analyte → MeasurementDefinition` and
`ExtractedBiomarker → NormalizationRevision → Observation`, and SHALL state
that the catalog lives in TypeScript while the database stores keys, versions,
digests, and provenance without catalog FK tables. The ADR SHALL NOT duplicate
that schema as ASCII.

#### Scenario: Schema ownership is unambiguous
- **WHEN** a reviewer inspects the ADR schema section
- **THEN** Mermaid shows TypeScript catalog entities separately from Postgres
  persistence entities and explicitly notes no catalog FK tables
- **AND** instrumental observations are shown as a separate non-lab lineage

### Requirement: ADR documents maturity and resolver policy
The ADR SHALL document definition maturity
(`provisional | reviewed | retired`) and resolver outcomes
(`resolved | partial | ambiguous | unmapped`) together with consumer
eligibility rules for concrete conversion, trends, and assessment.

#### Scenario: Incomplete results stay non-concrete
- **WHEN** an observation is `partial`, `ambiguous`, or `unmapped`
- **THEN** the ADR policy states it may remain visible as raw/pending evidence
  and MUST NOT become a concrete reviewed measurement, conversion, trend, or
  assessment input

#### Scenario: Reviewed resolved acceptance is concrete
- **WHEN** a reviewed concrete definition is accepted as resolved through the
  EH-106 writer path
- **THEN** the ADR policy allows concrete consumer eligibility only while the
  active revision remains valid

### Requirement: ADR records dependency and evidence ownership
The ADR SHALL list EH-104 as a direct dependency, identify EH-106 as the
source of candidate corpus/manifest/approvals evidence, and identify EH-107 as
separate CBC regression evidence.

#### Scenario: Evidence sources are not conflated
- **WHEN** a release reviewer reads the ADR dependency/evidence section
- **THEN** the 44-row candidate package is attributed to EH-106 and the CBC
  antipair suite is attributed to EH-107

### Requirement: ADR documents non-collapsed version axes
The ADR SHALL document distinct version axes for architecture/product model
Registry 2.0, catalog manifest version, resolver version, normalization
version, provenance schema version, and candidate package version, and SHALL
NOT collapse them into a single version label.

#### Scenario: Version axes remain distinct
- **WHEN** an engineer compares catalog manifest, resolver, and candidate
  package versions
- **THEN** the ADR treats them as separate axes rather than one “Registry 2.x”
  number

### Requirement: ADR states explicit non-goals for later roadmap work
The ADR SHALL explicitly defer EH-109 scoring, EH-110 alias provenance,
EH-111 unit/specimen compatibility, EH-112 incomplete UX, EH-115 decision
trace, EH-116 reprocessing, and EH-120 verification workflow activation.

#### Scenario: Later epics are not silently implied complete
- **WHEN** a reviewer checks ADR non-goals
- **THEN** EH-109 through EH-112, EH-115, EH-116, and EH-120 are listed as out
  of scope for the hard-cutover decision record
