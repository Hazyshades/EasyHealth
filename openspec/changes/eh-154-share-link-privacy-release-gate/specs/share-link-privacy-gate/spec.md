# share-link-privacy-gate

## ADDED Requirements

### Requirement: Threat model before release

The share-link release SHALL have a recorded threat model covering assets, actors, trust boundaries, enumeration, replay, scope expansion, cache/index leakage, rate limits, logging minimization, raw-document access, and incident response.

#### Scenario: Feature boundary changes

- **WHEN** EH-151, EH-152, or EH-153 changes token verification, management metadata, export formats, or download policy
- **THEN** the threat model and evidence matrix are reviewed again
- **AND** unresolved high or critical findings block release

### Requirement: Fail-closed release gate

The release gate SHALL execute focused evidence for invalid, expired, revoked, cross-profile, out-of-scope, PIN-failed, rate-limited, and export/download requests. The gate SHALL inspect cache/index headers and captured logs for token, PIN, source text, and storage-path leakage.

#### Scenario: High-severity finding remains

- **WHEN** the evidence contains an unresolved high or critical privacy/security finding
- **THEN** the gate status is blocked
- **AND** the milestone cannot be declared ready

#### Scenario: Mandatory controls pass with residual risk

- **WHEN** all mandatory controls pass and only documented low/medium residual risks remain
- **THEN** the gate records the commands, scenarios, evidence owner, risk owner, risk expiry, and sign-off
- **AND** the status is `ready-with-risk` only for the reviewed deployment configuration

#### Scenario: Mandatory controls pass without residual risk

- **WHEN** all mandatory controls pass and no residual risk remains
- **THEN** the gate records the commands, scenarios, evidence owner, and sign-off
- **AND** the status is `ready` only for the reviewed deployment configuration

### Requirement: Incident runbook

The release package SHALL define response steps for suspected token leakage, unauthorized access, anomalous rate-limit activity, emergency revoke, evidence preservation, and privacy escalation without copying bearer tokens into incident records.

#### Scenario: Suspected token leakage

- **WHEN** an operator reports a leaked share link
- **THEN** the runbook directs immediate share revocation, scope identification, minimized-event preservation, privacy escalation, and remediation tracking
- **AND** does not require pasting the plaintext token into a ticket or chat
