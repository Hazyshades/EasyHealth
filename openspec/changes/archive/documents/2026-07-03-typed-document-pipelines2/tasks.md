## 1. Database migration

- [x] 1.1 Extend `documents.document_type` check constraint with `discharge_summary`, `prescription`, `referral`
- [x] 1.2 Add columns on `documents`: `detected_document_type`, `type_mismatch_warning`, `type_mismatch_reason`
- [x] 1.3 Add `note_kind` (`consultation` | `discharge`) on `document_extracted_clinical_notes`
- [x] 1.4 Create `document_extracted_prescriptions` table with RLS
- [x] 1.5 Create `document_extracted_referrals` table with RLS
- [x] 1.6 Add `observation_kind` (`lab` | `instrumental`) on `observations` with default `lab`

## 2. Type classification and lab hardening

- [x] 2.1 Add `src/lib/documents/type-classification.ts` — LLM JSON schema for `detected_type`, `confidence`, `reason`
- [x] 2.2 Integrate classification step in `worker/src/pipeline.ts` before extraction; persist mismatch fields
- [x] 2.3 Update lab extraction prompt in `extraction.ts` to exclude vital signs and physical exam measurements
- [x] 2.4 Extend reprocess API to accept optional `document_type` override; clear prior extractions and mismatch flags

## 3. Extended document extraction

- [x] 3.1 Add `discharge-extraction.ts` (extends clinical note shape with discharge fields)
- [x] 3.2 Add `prescription-extraction.ts` with medications array schema
- [x] 3.3 Add `referral-extraction.ts` with referral fields schema
- [x] 3.4 Branch worker pipeline for `discharge_summary`, `prescription`, `referral`
- [x] 3.5 Generate `document_summary` for all three new types

## 4. Consultation schema refinement (path A)

- [x] 4.1 Migration: rename `documented_diagnoses` → `documented_problems` on `document_extracted_clinical_notes`
- [x] 4.2 Update `consultation-extraction.ts`: rename field, tighten prompt (exclude PMH/allergies/FH/exam from problems; include all vitals in exam_findings)
- [x] 4.3 Update worker pipeline, `structured-context.ts`, and reports context to use `documented_problems`
- [x] 4.4 Update `ConsultationInsightsPanel` label to "Problems noted in record (as written)"
- [x] 4.5 Tune consultation branch of `document-summary.ts` to cite specific plan items when present
- [ ] 4.6 Manual test: reprocess UMNwriteup as consultation — problems list excludes allergies/PMH; exam includes respirations and temperature

## 5. Instrumental observations

- [x] 5.1 Map instrumental `numeric_measures` to `observations` in worker after findings insert
- [x] 5.2 Implement upsert/dedup by profile + key + date + document id; delete on reprocess
- [x] 5.3 Include instrumental observations in deterministic health profile aggregation
- [x] 5.4 Add "From imaging/functional study" label in health profile drawer/cards

## 6. Upload and documents hub

- [x] 6.1 Extend `DocumentType` union and `DOCUMENT_TYPE_LABELS` in `health-systems.ts`
- [x] 6.2 Add upload routes/pages for discharge, prescription, referral (`upload-zone.tsx` hints)
- [x] 6.3 Add Documents hub tabs: Discharge summaries, Prescriptions, Referrals with empty states and CTAs
- [x] 6.4 Validate new types in `POST /api/upload`; reject `dicom` unchanged

## 7. Document viewer and API

- [x] 7.1 Expose mismatch fields on `GET /api/documents/[id]`
- [x] 7.2 Add type mismatch banner component with reprocess-as-suggested action
- [x] 7.3 Add viewer panels: discharge, prescription, referral (`document-insight-panels.tsx`)
- [x] 7.4 Wire panel titles and empty states for new types in `document-viewer.tsx`

## 8. Paid holistic synthesis

- [x] 8.1 Add `POST /api/health-profile/synthesis` with x402 middleware (default $0.02 USDC, env override)
- [x] 8.2 Implement force-regenerate logic in `holistic-synthesis.ts` bypassing cache hash
- [x] 8.3 Add `synthesis_stale` to `GET /api/health-profile` when input hash differs
- [x] 8.4 Add "Refresh synthesis" button on Health Profile with gateway payment flow
- [x] 8.5 Extend multi-source report context with discharge, prescription, referral data

## 9. Verification

- [ ] 9.1 Manual test: upload UMNwriteup.pdf as lab → mismatch warning → reprocess as consultation
- [ ] 9.2 Manual test: UMNwriteup consultation panel — problems vs exam/history boundaries (task 4.6)
- [ ] 9.3 Manual test: upload discharge PDF → discharge panel populated
- [ ] 9.4 Manual test: instrumental report with EF% → observation on health profile chart
- [ ] 9.5 Manual test: paid synthesis refresh returns 402 then 200 with new text
- [x] 9.6 Run `npx tsc --noEmit` and worker dev against all six active types

---

## Deferred — not in this change

- **DICOM upload, viewer, metadata worker** — explicitly out of scope
- **`other` document type** — catch-all deferred
- **Type-specific x402 upload pricing** — single $0.01 upload price unchanged
- **Batch legacy re-tag** — manual reprocess only
- **Russian or other localization** — EN-only per product rules
- **Consultation path B** — separate PMH, allergies, family history, vitals arrays (full H&P schema)
