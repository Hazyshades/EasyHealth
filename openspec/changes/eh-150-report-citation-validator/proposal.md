# Proposal: eh-150-report-citation-validator

Domain: **reports**

## Why

A structured citation field is not sufficient if a report can reference a missing observation, a source from another profile, an out-of-scope document, or an unsupported factual statement. Reports need a deterministic publish gate before they can be shared or exported.

## What Changes

- Add a validator for the EH-148 report/evidence contract.
- Validate schema version, citation shape, source existence, profile ownership, report scope, and allowed evidence kinds.
- Reject or sanitize broken and cross-profile citations; never publish a report that contains an unresolved factual citation.
- Remove unsupported factual claims or mark them with an explicit limitation according to a deterministic policy; do not claim that the validator proves clinical truth.
- Return structured validation issues for generation, persistence, share, and export callers.
- Add focused coverage for valid, missing, broken, out-of-scope, cross-profile, and unsupported-claim cases.

## Capabilities

### New Capabilities

- `report-citation-validation`: Deterministic validation and sanitization gate for source-grounded report content.

### Modified Capabilities

- `reports-api`: Generated reports must pass citation validation before persistence or publication.
- `multi-source-reports`: Report context and source snapshots must provide the identities needed by the validator.

## Impact

The validator is a pure report-boundary module with profile-scoped source loading at its adapter seam. EH-148 owns the persisted contract and generation route; EH-150 owns validation rules and evidence. EH-151 and EH-153 may consume only validated report DTOs.
