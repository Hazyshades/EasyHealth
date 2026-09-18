# Proposal: eh-148-doctor-visit-brief

Domain: **reports**

## Why

The current report pipeline persists free-form sections and source filenames, but it does not give a doctor a stable, source-addressable brief. Factual statements can therefore outlive their evidence, omit missing data, or point to a source outside the selected document scope.

## What Changes

- Add a versioned Doctor Visit Brief contract with explicit report scope, generated-at metadata, limitations, and source-grounded claims.
- Preserve stable identifiers for every cited observation, finding, clinical note, prescription, referral, or document summary; display labels remain snapshots, not authorization grants.
- Materialize the exact document scope for every new report, including the all-eligible case; do not persist `null` as an implicit scope for new reports.
- Generate the brief from structured source records and require factual sections to carry evidence references. Missing evidence is rendered as a limitation, not inferred.
- Add a doctor-facing brief template for the existing report detail surface without adding diagnosis, treatment, or urgency recommendations.
- Expose a versioned contract for EH-149 dynamics output, EH-150 citation validation, EH-151 sharing, and EH-153 export.

## Capabilities

### New Capabilities

- `doctor-visit-brief`: Structured, source-grounded doctor visit brief content and presentation.

### Modified Capabilities

- `reports-api`: Persist the versioned brief contract, immutable source scope, and evidence snapshots during generation.
- `reports-ui`: Render the brief sections, citations, limitations, and source ledger.
- `multi-source-reports`: Carry stable evidence identities from structured context into generated report claims.

## Impact

Affected areas include report generation and prompt parsing, the reports persistence migration, report detail rendering, and the shared report contract consumed by EH-149, EH-150, EH-151, and EH-153. Legacy reports remain readable as legacy content but are not silently upgraded with fabricated citations.
