## MODIFIED Requirements

### Requirement: Serve persisted decision reasoning without resolver recomputation

The authenticated document biomarker contract SHALL return the stored decision trace and independent read source/quality metadata for active and historical normalization revisions belonging to the requesting profile. `source` SHALL identify `persisted`, `preview`, or `none`; `quality` SHALL identify `available`, `unavailable`, or `conflict`. For any row with a persisted active revision, the review projection SHALL derive technical details from that revision's stored trace and SHALL NOT invoke the current resolver to explain the historical decision.

For an extracted row that has no normalization revision, the contract MAY return a current resolver preview only when it is explicitly marked `source = preview` and `notPersisted = true`. A legacy revision with no trace SHALL be represented as `source = persisted`, `quality = unavailable`; the system SHALL NOT substitute a recomputed trace. Persisted disagreements between revision fields, operational evidence, technical trace, or version metadata SHALL be represented as `quality = conflict` and SHALL not be repaired or downgraded.

The document review interface SHALL label persisted traces as the decision recorded for the revision and SHALL show outcome rationale, winning candidate where present, versions, candidate evidence-code summaries, missing axes, hard conflicts, and independent source/quality state. It SHALL label a preview, unavailable legacy trace, and conflicting persisted data distinctly.

#### Scenario: A catalog changes after a revision was created

- **WHEN** a user or support agent opens technical details for a persisted revision after the resolver or catalog has changed
- **THEN** the interface and API SHALL show the stored trace and its original catalog/resolver versions
- **AND** they SHALL not show a trace recalculated with the current resolver

#### Scenario: A legacy revision has no trace

- **WHEN** a document contains a historical normalization revision created before trace persistence
- **THEN** the API SHALL return `source = persisted` and `quality = unavailable`
- **AND** the interface SHALL explain that no historical trace was stored
- **AND** no live resolver output SHALL be presented as its historical explanation

#### Scenario: Persisted fields conflict

- **WHEN** the stored outcome, selected identity, operational evidence, technical trace, or version metadata disagree
- **THEN** the API SHALL return `source = persisted` and `quality = conflict` with stable conflict codes
- **AND** it SHALL preserve the disagreement without choosing a corrected value or invoking the current resolver

#### Scenario: A row without a revision receives preview

- **WHEN** an extracted row has no active normalization revision and the caller explicitly requests a current preview
- **THEN** the API SHALL return `source = preview`, `quality = available`, and `notPersisted = true`
- **AND** the preview SHALL not grant downstream definition-specific eligibility

#### Scenario: An unauthenticated or foreign-profile request attempts inspection

- **WHEN** a request lacks an authenticated profile or addresses a document owned by another profile
- **THEN** the document biomarker contract SHALL deny access before returning revision, trace, or quality data
