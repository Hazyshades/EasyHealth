## MODIFIED Requirements

### Requirement: Candidate approvals SHALL be bound to verified release inputs

A Registry 2.0 candidate release SHALL be launchable only when every required false-concrete, score-affecting, and release-gate approval is bound to the exact candidate-input hash produced from the frozen corpus, policy, registry manifest, catalog version, resolver version, normalization version, and, when document extraction is in scope, the OCR provider, resolved OCR model, OCR adapter version, and OCR artifact schema version. Stale approvals MUST fail closed.

#### Scenario: Resolver, catalog, or OCR identity invalidates prior approval

- **WHEN** the candidate-input hash changes because catalog, resolver, normalization, corpus, policy, or OCR identity changed
- **THEN** approvals bound to the prior hash MUST NOT satisfy the release gate
- **AND** the candidate release MUST remain non-launchable until matching approvals are renewed

#### Scenario: Verified unchanged outcomes permit approval renewal

- **WHEN** the new candidate report has complete expected classifications, every threshold passes, processing errors and false concrete resolutions are zero, OCR identity is explicitly recorded, and required reviewers renew approval for the new hash
- **THEN** the candidate release SHALL become launchable without changing resolver behavior or corpus expectations

### Requirement: Release evidence SHALL remain auditable

Renewed approval records SHALL identify their scope, role, approver, status, exact candidate-input hash, and a note describing the reviewed evidence. Score-affecting approvals MUST identify the approved binding key. OCR-enabled evidence MUST identify the OCR provider/model/adapter/artifact versions and the de-identified corpus report used for approval.

#### Scenario: OCR release evidence explains renewal

- **WHEN** an OCR-enabled candidate is approved for a changed candidate-input hash
- **THEN** its evidence MUST state that the OCR quality report, threshold report, classification report, and false-concrete/false-overlay reports were reviewed
- **AND** every required approval for that release MUST share the same verified candidate-input hash
