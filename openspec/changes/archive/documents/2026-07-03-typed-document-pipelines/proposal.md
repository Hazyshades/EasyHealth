## Why

EasyHealth today treats almost every upload as a lab report: one biomarker extraction prompt, viewer panel titled "Extracted biomarkers", Health Profile driven only by `observations`, and doctor summaries built solely from biomarker rows. Users need to upload instrumental reports (imaging, ECG, etc.) and consultation notes as first-class records, see type-appropriate structured summaries in the document viewer, and have Health Profile and paid reports synthesize **all** document types—not just numeric labs.

## What Changes

- **BREAKING**: Rename `document_type` values: `lab` → `lab_result`, `imaging` → `instrumental_report`, `consultation` → `consultation_note`; migrate existing rows. `dicom` remains reserved (UI tab only; upload still blocked).
- Add `file_kind` on documents (`pdf`, `image`, `unknown`) derived from mime/extension at ingest.
- Explicit upload flows for **Lab results**, **Imaging studies**, and **Consultations** (type chosen by user before pay/upload). DICOM tab shows "Coming soon" with no upload.
- Worker branches extraction by `document_type`: biomarkers for labs; instrumental findings for imaging; clinical note fields for consultations. Each run also produces a short LLM **document summary** stored on the document.
- Extend document viewer right panel by type: labs show biomarkers + brief summary; imaging/consultations show structured fields + brief summary.
- Add staging storage for non-lab structured extraction (`document_extracted_findings`, `document_extracted_clinical_notes`) with review rules: biomarkers keep accept/reject; instrumental and consultation extractions auto-accept to profile-facing tables after processing (editable display, no numeric profile merge).
- Extend Health Profile with an LLM-assisted **holistic synthesis** layer that combines accepted biomarkers, instrumental findings, and consultation notes across documents (cached, refreshable).
- Extend `POST /api/reports` (doctor summary, $0.05) to include structured data from all selected document types, not only `observations`.
- DICOM: UI tab and schema groundwork (`file_kind` ready for future `dicom`); no upload or viewer in this change.

## Capabilities

### New Capabilities

- `typed-document-upload`: Per-type upload pages/CTAs, `document_type` + `file_kind` on ingest, DICOM tab stub.
- `document-type-extraction`: Worker pipelines and Zod schemas per document type; document-level summary generation.
- `document-structured-insights`: Staging tables and profile-facing storage for instrumental findings and consultation notes.
- `typed-document-viewer`: Type-specific right panel (biomarkers vs findings vs clinical note + summaries).
- `holistic-health-profile`: LLM synthesis across labs, imaging, and consultations for Health Profile API/UI.
- `multi-source-reports`: Doctor summary prompt and API context built from biomarkers plus non-lab structured extractions.

### Modified Capabilities

- `documents-hub`: Upload CTAs per tab; renamed type labels; instrumental/consultation empty states with upload links.
- `documents-api`: New `document_type` enum values; list/filter by renamed types; expose summaries and structured fields.
- `health-profile`: Requirements for non-biomarker signals and holistic synthesis (in addition to deterministic marker aggregation).
- `health-profile-api`: Response shape includes synthesis and cross-document context.
- `reports-api`: Report generation uses multi-source document context; scope selection includes non-lab documents with structured data.
- `reports-ui`: Copy reflects global analysis across document types.

## Impact

- **Database**: Migration renaming `document_type` values; add `file_kind`, `document_summary`, optional `modality`; new tables `document_extracted_findings`, `document_extracted_clinical_notes`, `profile_health_synthesis` (or equivalent cache).
- **Worker**: Branching in `pipeline.ts`; new extraction modules and prompts; shared preview/OCR path unchanged.
- **API**: Upload validation per type; new document detail fields; extended health-profile and reports routes.
- **Frontend**: Upload picker, documents hub CTAs, document viewer panels by type, health profile synthesis section.
- **Product safety**: All LLM outputs remain educational; document-stated diagnoses quoted as source text; mandatory disclaimer on summaries.
- **Out of scope (deferred)**: DICOM upload/viewer, discharge/prescription/referral types, auto type-mismatch detection, bounding-box highlight.
