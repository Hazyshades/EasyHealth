## 1. Schema and type migration

- [x] 1.1 Add migration: rename `document_type` values (`lab`→`lab_result`, `imaging`→`instrumental_report`, `consultation`→`consultation_note`), update check constraint, add `file_kind`, `document_summary`, nullable `modality` and `document_subtype` on `documents`
- [x] 1.2 Create `document_extracted_findings` table with RLS service policies
- [x] 1.3 Create `document_extracted_clinical_notes` table with RLS service policies
- [x] 1.4 Create `profile_health_synthesis` cache table with `profile_id`, `synthesis_text`, `source_document_ids`, `input_hash`, `model`, `generated_at`
- [x] 1.5 Update `DocumentType` in `src/lib/health-systems.ts` and all references (`lab`→`lab_result`, etc.)
- [x] 1.6 Update `isDocumentType`, upload validation, documents API filters, and hub tabs to new enum values

## 2. Upload UX

- [x] 2.1 Update `/app/upload` to accept `type=lab_result|instrumental_report|consultation_note` with English copy per type
- [x] 2.2 Update `UploadZone` helper text and labels per `documentType` prop
- [x] 2.3 Add per-tab upload CTAs on `/app/documents` for lab, imaging, and consultations
- [x] 2.4 Set `file_kind` in `POST /api/upload` from mime/extension
- [x] 2.5 Keep DICOM upload returning HTTP 400; DICOM tab shows Coming soon only

## 3. Extraction schemas and worker pipelines

- [x] 3.1 Add Zod schemas for instrumental and consultation extraction in `src/lib/documents/` (shared with worker)
- [x] 3.2 Add `extractInstrumentalFromText/Image` and `extractConsultationFromText/Image` with type-specific prompts
- [x] 3.3 Add `generateDocumentSummary(model, type, structuredPayload)` helper
- [x] 3.4 Branch `worker/src/pipeline.ts` by `document_type` after shared preview/OCR steps
- [x] 3.5 Persist instrumental rows to `document_extracted_findings` with `status=accepted`
- [x] 3.6 Persist consultation row to `document_extracted_clinical_notes` with `status=accepted`
- [x] 3.7 Write `documents.document_summary` on successful extraction for all types
- [x] 3.8 Leave lab biomarker flow unchanged (`needs_review` + existing accept path)

## 4. Document APIs

- [x] 4.1 Extend `GET /api/documents/[id]` with `document_summary`, findings, or clinical note payload by type
- [x] 4.2 Extend `GET /api/documents` list fields: `file_kind`, new type values
- [x] 4.3 Update `eligible_for_report` query to include documents with accepted findings or clinical notes
- [x] 4.4 Add internal helper `buildDocumentStructuredContext(profileId, documentIds)` for reports and synthesis

## 5. Typed document viewer

- [x] 5.1 Refactor `document-viewer.tsx` right panel into type-specific subcomponents
- [x] 5.2 Lab panel: biomarkers + summary card
- [x] 5.3 Instrumental panel: modality, region, findings, impression + summary
- [x] 5.4 Consultation panel: structured sections + summary
- [x] 5.5 English empty states per type when extraction yields no structured rows

## 6. Holistic Health Profile

- [x] 6.1 Implement `buildHolisticSynthesisInput(profileId)` aggregating observations, findings, clinical notes, summaries
- [x] 6.2 Implement `generateHolisticSynthesis` LLM call with safety prompt and disclaimer
- [x] 6.3 Add cache read/write using `profile_health_synthesis` and `input_hash` invalidation
- [x] 6.4 Extend `GET /api/health-profile` with `holistic_synthesis` field (deterministic `systems` unchanged)
- [x] 6.5 Add synthesis section to `/app/profile` UI with loading state and disclaimer
- [x] 6.6 Update empty state CTA to mention all document types

## 7. Multi-source reports

- [x] 7.1 Update `POST /api/reports` context builder to pass biomarkers + findings + clinical notes + summaries
- [x] 7.2 Adjust 400 gate: fail only when zero structured content in scope
- [x] 7.3 Update specialty system prompts to reference multi-source context
- [x] 7.4 Update reports create page helper copy and document modal type labels
- [x] 7.5 Show instrumental/consultation documents in selection modal when eligible
- [x] 7.6 Clarify abnormal-only helper text (biomarkers only filter)

## 8. Verification and polish

- [ ] 8.1 Manual test: upload lab PDF → biomarkers + summary in viewer
- [ ] 8.2 Manual test: upload instrumental image/PDF → findings panel + report inclusion
- [ ] 8.3 Manual test: upload consultation → clinical note panel + health profile synthesis
- [ ] 8.4 Manual test: paid report with mixed document types
- [ ] 8.5 Verify legacy documents with old type values migrated correctly
- [ ] 8.6 Run worker locally against all three types; confirm job failure messages surface in UI

---

## Deferred — not in this change (implement later)

These items are documented in `design.md` but intentionally excluded from tasks above:

- **DICOM file upload** — accept `.dcm` / series ZIP, storage layout, size limits
- **DICOM viewer** — slice navigation, window/level, series thumbnails (Cornerstone or equivalent)
- **DICOM metadata worker** — parse StudyInstanceUID, SeriesInstanceUID, modality from headers
- **`file_kind` values** `dicom` and `dicom_series` — enable when upload ships
- **Additional document types** — `discharge_summary`, `prescription`, `referral`, `other`
- **Auto type validation** — LLM warning when user-selected type mismatches content (e.g. H&P uploaded as lab)
- **Type-specific x402 pricing** — different prices per document type
- **Instrumental numeric measures → observations** — mapping EF, dimensions, etc. into biomarker chart
- **Paid health profile refresh** — x402-gated synthesis regeneration
- **Reprocess-all-legacy** — batch re-tag old `lab` uploads that are actually consultations
- **Discharge / referral UI tabs** — new hub tabs when types are added
- **Russian or other localization** — EN-only per product rules
