## Why

`typed-document-pipelines` shipped three document types with user-selected routing, but real uploads expose gaps: History & Physical PDFs uploaded as labs yield misleading "biomarkers" and summaries; instrumental reports contain numeric measures that never reach the health chart; holistic synthesis refreshes for free with no monetization hook; and common document classes (discharge, prescription, referral) are still unsupported. This change closes the highest-value deferred items from phase 1 without opening DICOM scope.

## What Changes

- Add **auto type-mismatch warning** after upload processing: lightweight content classification compares detected document class to user-selected `document_type`; UI shows a non-blocking banner with suggested type and one-click reprocess with corrected type.
- Harden **lab extraction** to exclude vital signs and physical-examination measurements unless the document is clearly a laboratory report panel.
- Add document types **`discharge_summary`**, **`prescription`**, **`referral`** with upload flows, hub tabs, worker extraction schemas, and type-appropriate viewer panels (DICOM remains out of scope).
- Map **instrumental numeric measures** (e.g. EF %, dimensions, spirometry values) from `document_extracted_findings` into `observations` with normalized keys so they appear on the Health Profile chart alongside lab biomarkers.
- Add **paid holistic synthesis refresh** via x402: user can pay to regenerate `profile_health_synthesis` when new documents exist or cache is stale.
- **Consultation schema refinement (path A):** rename `documented_diagnoses` → `documented_problems`; tighten extraction prompt so problem/assessment lists exclude PMH, allergies, family history, and physical exam findings; require all vital signs in `exam_findings` when present; update viewer label to health-literacy wording.
- **BREAKING**: Extend `documents.document_type` check constraint with three new enum values; migration maps no legacy rows (new types only).
- **BREAKING**: Rename `documented_diagnoses` column to `documented_problems` on `document_extracted_clinical_notes` (JSONB); update API and UI field names.

## Capabilities

### New Capabilities

- `document-type-validation`: Post-upload content classification, mismatch detection, suggested type, reprocess-with-type UX.
- `extended-document-types`: Discharge summary, prescription, and referral types — upload, extraction, storage, viewer panels.
- `instrumental-observations`: Promotion of instrumental `numeric_measures` into `observations` for charting.
- `paid-health-synthesis`: x402-gated regeneration of holistic health profile synthesis.

### Modified Capabilities

- `typed-document-upload`: Upload CTAs and routes for discharge, prescription, referral; mismatch warning surfacing after processing.
- `document-type-extraction`: New extraction pipelines for three document types; lab prompt excludes non-lab vitals; consultation prompt uses `documented_problems` with stricter section rules.
- `documents-hub`: Hub tabs and empty states for discharge, prescription, referral.
- `documents-api`: Extended `document_type` enum; expose `suggested_document_type` and `type_mismatch_warning` on document detail.
- `typed-document-viewer`: Right-panel layouts for discharge, prescription, referral; consultation panel shows "Problems noted in record" instead of diagnoses label.
- `holistic-health-profile`: Paid refresh affordance and cache invalidation rules.
- `health-profile-api`: New paid synthesis refresh endpoint (x402); response includes refresh metadata.

## Impact

- **Database**: Migration extending `document_type` check; optional columns on `documents` for mismatch metadata (`detected_document_type`, `type_mismatch_warning`); observation rows sourced from instrumental measures.
- **Worker**: Classification step before/alongside extraction; three new extraction modules; instrumental → observations writer; lab prompt update.
- **API**: New x402 route for synthesis refresh; document detail fields; reprocess endpoint accepts optional `document_type` override.
- **Frontend**: Mismatch banner in document viewer; three new upload/hub paths; "Refresh synthesis" paid button on Health Profile.
- **Payments**: One new x402 endpoint (synthesis refresh price TBD in design, default $0.02 USDC).
- **Explicitly out of scope**: DICOM upload, DICOM viewer, DICOM metadata worker, `file_kind` dicom values, type-specific upload pricing, batch legacy re-tag job, localization.
