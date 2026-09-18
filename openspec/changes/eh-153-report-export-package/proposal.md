# Proposal: eh-153-report-export-package

Domain: **reports**

## Why

The report detail view has no durable handoff format for a clinician. Copying rendered text loses source references, ranges, limitations, generation metadata, and Unicode fidelity; exporting raw rows would bypass the validated report scope.

## What Changes

- Add export adapters for PDF, CSV, and JSON using the validated EH-148 report/evidence DTO.
- Include generated-at time, contract and validator versions, limitations, source references, and reference ranges where applicable.
- Keep CSV rows tied to source observation/document IDs and preserve native/display units without unsafe conversion.
- Produce a readable Unicode PDF with the same sections and citations as the on-screen report.
- Apply owner-session authorization or the EH-151 share scope and explicit format allow-list; never include unrelated documents or raw storage paths.
- Add export controls to the report detail/share surfaces through a separate component; EH-148 and EH-151 remain page integration owners.

## Capabilities

### New Capabilities

- `report-export-package`: Scope-safe PDF, CSV, and JSON exports of validated report content.

### Modified Capabilities

- `reports-ui`: Add export actions and clear failure states without changing report content semantics.

## Impact

The export module is a read-only adapter over the canonical report contract. PDF rendering uses a pinned server-side renderer with an embedded Unicode font; JSON and CSV are deterministic serializers. EH-154 verifies that export cannot widen a share scope or bypass citation validation.
