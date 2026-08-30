## ADDED Requirements

### Requirement: Documentation index links resolve
Every relative Markdown link in `docs/README.md` SHALL resolve to a tracked repository file or directory.

#### Scenario: Maintainer verifies documentation navigation
- **WHEN** the documentation link verifier runs
- **THEN** it SHALL exit non-zero for each missing target
- **AND** it SHALL name the source link and resolved missing path.