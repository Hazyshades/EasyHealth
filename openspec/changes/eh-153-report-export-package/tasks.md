# Tasks: eh-153-report-export-package

Domain: **reports**

## 1. Export access adapter

- [ ] 1.1 Implement owner and EH-151 share adapters that load only validated EH-148 content, its authorized source ledger, and an optional frozen EH-149 `BiomarkerDynamicsReport` DTO.
- [ ] 1.2 Reject legacy/unvalidated reports, missing required dynamics data, and unauthorized format/resource requests with safe stable errors.
- [ ] 1.3 Keep authorization and the `allowed_export_formats` check outside serializers so PDF, CSV, and JSON cannot widen report or document scope.

## 2. Format serializers

- [ ] 2.1 Implement deterministic JSON serialization with contract, validator, generated-at, limitation, claim, and source metadata.
- [ ] 2.2 Implement CSV `record_type` rows for metadata, claims, and measurements; measurement rows come from the supplied dynamics DTO with source IDs, document IDs, native/display values and units, ranges, dates, and conversion indicators.
- [ ] 2.3 Add a pinned server-side PDF renderer and licensed embedded Unicode font; preserve section order, citations, limitations, disclaimer, and versions.
- [ ] 2.4 Bound report size and fail explicitly on renderer/font failure instead of returning a partial PDF.

## 3. UI and verification

- [ ] 3.1 Add the leaf export-actions component with format availability, pending state, and safe failure copy.
- [ ] 3.2 Provide the export-actions props contract and hand off integration: EH-148 wires authenticated detail, EH-151 wires the named public-share slot; EH-153 does not edit either page.
- [ ] 3.3 Add fixtures for Unicode, long labels, empty optional sections, mixed units, dynamics DTO points, denied formats, and out-of-scope documents.
- [ ] 3.4 Run the EH-153 QA checklist and provide download-policy/header evidence to EH-154.
