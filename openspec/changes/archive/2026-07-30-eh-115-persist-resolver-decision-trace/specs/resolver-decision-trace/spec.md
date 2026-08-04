## ADDED Requirements

### Requirement: Persist an immutable decision trace for every normalization outcome

The system SHALL create a canonical `ResolverDecisionTrace` whenever it creates a normalization revision from a resolver outcome. The trace SHALL cover `resolved`, `ambiguous`, `partial`, and `unmapped` outcomes and SHALL remain attached to the revision that produced it.

The trace SHALL include the trace schema version, resolver outcome, decision kind, input-evidence hash, catalog manifest version and digest, resolver version, nullable winning candidate key, candidates with definition key, registry maturity, score, accepted/rejected evidence codes and strengths, missing axes, and hard-conflict codes.

The system SHALL preserve candidate ordering and de-duplicated aggregate axes/conflicts deterministically. A trace with an unrecognized schema version, unknown field, unsupported enum, invalid outcome/identity combination, or non-canonical ordering SHALL be rejected.

#### Scenario: A row resolves to one reviewed candidate
- **WHEN** the resolver produces one compatible reviewed candidate with no missing axis
- **THEN** the new revision persists a trace with outcome `resolved`, decision kind `single_reviewed_candidate`, that candidate as the winning candidate, its maturity and score, and its accepted/rejected evidence-code summary

#### Scenario: A recognized row remains incomplete
- **WHEN** the resolver produces compatible candidates but cannot establish all required axes
- **THEN** the new revision persists a trace with outcome `partial`, decision kind `recognized_incomplete`, no winning candidate, the candidate summaries, and the missing-axis explanation

#### Scenario: Candidates conflict or tie
- **WHEN** the resolver produces multiple concrete candidates or candidates with hard conflicts
- **THEN** the new revision persists an `ambiguous` or `partial` trace, as applicable, with no winning candidate and the rejected candidates, scores, and hard-conflict codes needed to explain the result

#### Scenario: No candidate matches
- **WHEN** the resolver produces no candidate for an extracted row
- **THEN** the new revision persists an `unmapped` trace with decision kind `no_matching_candidate`, no winning candidate, and no fabricated candidate or source evidence

### Requirement: Redact trace and log content by construction

A persisted or API-returned resolver decision trace SHALL contain only allowlisted machine identifiers, numeric scores, enum values, evidence codes/strengths, and release or schema version identifiers. It SHALL NOT contain raw labels, raw values, raw units, reference ranges, source text, section context, neighbouring labels, document metadata, patient identifiers, free-form correction reasons, or arbitrary `observed`/`expected` evidence strings.

Application logging for trace creation, validation, persistence, and reading SHALL NOT serialize raw resolver input, extracted rows, source content, complete trace objects, or RPC payloads.

#### Scenario: Resolver input contains document text and a raw value
- **WHEN** a resolver input contains a raw label, raw value text, source-derived section context, or neighbouring labels
- **THEN** the stored trace and its authenticated API representation omit those values while retaining the safe explanation codes and candidate identifiers

#### Scenario: A caller submits a malformed trace payload to the writer RPC
- **WHEN** a direct service RPC call provides a trace with an unknown field, arbitrary string, raw input value, unsupported enum, or mismatched schema version
- **THEN** the writer rejects the transaction with a stable validation error and creates no revision or projection update

### Requirement: Persist traces atomically with normalization revisions

The service-only normalization writer SHALL validate and persist the canonical trace and trace schema version in the same transaction that creates or reuses the normalization revision, promotes it, and synchronizes its observation projection. The trace columns are immutable once populated.

Idempotent retry identity SHALL include the canonical trace. A retry with the same source and request hash SHALL reuse its existing revision and trace; a changed trace SHALL not overwrite a persisted trace.

Manual correction SHALL append a new revision with a `manual_selection` trace that identifies the selected compatible reviewed candidate and retains the compatible resolver evidence. It SHALL NOT mutate prior revision traces.

#### Scenario: An accepted incomplete row is written atomically
- **WHEN** a user accepts a partial, ambiguous, or unmapped extracted row
- **THEN** the writer creates and promotes one pending revision whose stored trace has the same outcome and no concrete winning identity
- **AND** the active observation projection remains synchronized with that revision

#### Scenario: A writer retry occurs
- **WHEN** the same normalization write request is retried after its first transaction committed
- **THEN** the writer reports reuse of the existing revision and leaves its persisted decision trace unchanged

#### Scenario: A direct update targets a stored trace
- **WHEN** any non-creation path attempts to modify a populated revision trace or trace schema version
- **THEN** the database rejects the update and retains the original trace

### Requirement: Serve persisted decision reasoning without resolver recomputation

The authenticated document biomarker contract SHALL return the stored decision trace and trace availability for active and historical normalization revisions belonging to the requesting profile. For any row with a persisted active revision, the review projection SHALL derive technical details from that revision’s stored trace and SHALL NOT invoke the current resolver to explain the historical decision.

For an extracted row that has no normalization revision, the contract MAY return a current resolver preview only when it is explicitly marked as `preview` and `notPersisted`. A legacy revision with no trace SHALL be represented as unavailable; the system SHALL NOT substitute a recomputed trace.

The document review interface SHALL label persisted traces as the decision recorded for the revision and SHALL show outcome rationale, winning candidate where present, versions, candidate evidence-code summaries, missing axes, and hard conflicts. It SHALL label a preview or unavailable legacy trace distinctly.

#### Scenario: A catalog changes after a revision was created
- **WHEN** a user or support agent opens technical details for a persisted revision after the resolver or catalog has changed
- **THEN** the interface and API show the stored trace and its original catalog/resolver versions
- **AND** they do not show a trace recalculated with the current resolver

#### Scenario: A legacy revision has no trace
- **WHEN** a document contains a historical normalization revision created before trace persistence
- **THEN** the API marks that revision trace unavailable and the interface explains that no historical trace was stored
- **AND** no live resolver output is presented as its historical explanation

#### Scenario: An unauthenticated or foreign-profile request attempts inspection
- **WHEN** a request lacks an authenticated profile or addresses a document owned by another profile
- **THEN** the document biomarker contract denies access before returning revision or trace data