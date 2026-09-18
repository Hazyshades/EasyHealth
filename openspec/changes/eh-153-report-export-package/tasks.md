# Tasks: eh-153-report-export-package

Domain: **reports**

## 1. Export access adapter

- [ ] 1.1 Implement the owner and EH-151 share access adapters that load only validated EH-148 content and its authorized source ledger.
- [ ] 1.2 Reject legacy/unvalidated reports and unauthorized format/resource requests with safe stable errors.
- [ ] 1.3 Keep authorization outside serializers so PDF, CSV, and JSON cannot widen report or document scope.

## 2. Format serializers

- [ ] 2.1 Implement deterministic JSON serialization with contract, validator, generated-at, limitation, claim, and source metadata.
- [ ] 2.2 Implement CSV measurement serialization with source IDs, document IDs, native/display values and units, ranges, dates, and conversion indicators.
- [ ] 2.3 Add a pinned server-side PDF renderer and licensed embedded Unicode font; preserve section order, citations, limitations, disclaimer, and versions.
- [ ] 2.4 Bound report size and fail explicitly on renderer/font failure instead of returning a partial PDF.

## 3. UI and verification

- [ ] 3.1 Add the leaf export-actions component with format availability, pending state, and safe failure copy.
- [ ] 3.2 Integrate actions through the EH-148 detail-page seam and the approved EH-151 share surface without duplicating report rendering.
- [ ] 3.3 Add fixtures for Unicode, long labels, empty optional sections, mixed units, denied formats, and out-of-scope documents.
- [ ] 3.4 Run the EH-153 QA checklist and provide download-policy/header evidence to EH-154.
