## ADDED Requirements

### Requirement: Candidate approvals SHALL be bound to verified release inputs

A Registry 2.0 candidate release SHALL be launchable only when every required false-concrete, score-affecting, and release-gate approval is bound to the exact candidate-input hash produced from the frozen corpus, policy, registry manifest, catalog version, resolver version, and normalization version. Stale approvals MUST fail closed.

#### Scenario: Resolver or catalog identity invalidates prior approval

- **WHEN** the candidate-input hash changes because catalog, resolver, normalization, corpus, or policy identity changed
- **THEN** approvals bound to the prior hash MUST NOT satisfy the release gate
- **AND** the candidate release MUST remain non-launchable until matching approvals are renewed

#### Scenario: Verified unchanged outcomes permit approval renewal

- **WHEN** the new candidate report has 44 of 44 expected classifications, every threshold passes, processing errors and false concrete resolutions are zero, and required reviewers renew approval for the new hash
- **THEN** the candidate release SHALL become launchable without changing resolver behavior or corpus expectations

### Requirement: Release evidence SHALL remain auditable

Renewed approval records SHALL identify their scope, role, approver, status, exact candidate-input hash, and a note describing the reviewed evidence. Score-affecting approvals MUST identify the approved binding key.

#### Scenario: Approval evidence explains renewal

- **WHEN** an approval is renewed for a changed candidate-input hash
- **THEN** its record MUST state that the new threshold report, classification report, and false-concrete report were reviewed
- **AND** every required approval for that release MUST share the same verified candidate-input hash
