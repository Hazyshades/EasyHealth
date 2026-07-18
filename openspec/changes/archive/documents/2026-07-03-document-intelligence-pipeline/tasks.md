## 1. Database schema (PR1 foundations + PR2 full)

- [x] 1.1 Migration: add `mime_type`, `file_size_bytes`, `original_storage_path`, `processing_status`, `processing_error`, `thumbnail_storage_path`, `page_count`, `processing_version`, `extraction_model`, `processed_at` to `documents`
- [x] 1.2 Migration: create `document_pages` table with `page_number`, `preview_storage_path`, `width`, `height`, `ocr_text`
- [x] 1.3 Migration: create `document_processing_jobs` table
- [x] 1.4 Migration: create `document_extracted_biomarkers` table with `processing_version`, `extraction_model`, `status` default `needs_review`
- [x] 1.5 Migration: add `source_extracted_biomarker_id` to `observations` referencing `document_extracted_biomarkers`
- [x] 1.6 Backfill helper: set `original_storage_path` from legacy `storage_path` where null

## 2. Document viewer APIs (PR1)

- [x] 2.1 Add `GET /api/documents/[id]` — metadata, `page_count`, `processing_status`, legacy vs pipeline flag
- [x] 2.2 Add `GET /api/documents/[id]/file` — signed URL for original, `Cache-Control: no-store`, no storage path leak
- [x] 2.3 Add `GET /api/documents/[id]/thumbnail` — signed URL when `thumb.webp` exists
- [x] 2.4 Add `GET /api/documents/[id]/pages/[pageNumber]` — signed URL + dimensions
- [x] 2.5 Shared helper: `assertDocumentOwner(profileId, documentId)` + signed URL factory

## 3. Document viewer UI (PR1)

- [x] 3.1 Create `/app/documents/[id]` page — header (filename, date, status, download)
- [x] 3.2 Left panel: page preview viewer with page nav and zoom (`react-zoom-pan-pinch` or CSS); fallback to original image or PDF iframe/download
- [x] 3.3 Right panel (legacy mode): load `observations` by `document_id` via existing biomarkers/health-profile API or new endpoint
- [x] 3.4 Make `/app/documents` rows clickable; link to detail page
- [x] 3.5 Show medical disclaimer on document detail page
- [x] 3.6 Optional: thumbnail column in documents list when available

## 4. Async upload flow (PR2)

- [x] 4.1 Update storage upload path to `{profileId}/{documentId}/original.{ext}` for new documents
- [x] 4.2 Refactor `POST /api/upload`: save file, insert document, enqueue `full_pipeline` job, return `{ documentId, processingStatus }`
- [x] 4.3 Remove `upsertObservations` and sync `extractBiomarkersFromFile` from upload handler
- [x] 4.4 Update `UploadZone` for async response — redirect with processing message, no immediate biomarkers
- [x] 4.5 Documents list: show `processing_status` (processing / needs_review / ready / failed)

## 5. Background worker (PR2–PR3)

- [x] 5.1 Create `worker/` package with Dockerfile (Node + poppler-utils + sharp)
- [x] 5.2 Implement job poller with lock, retry, and max attempts on `document_processing_jobs`
- [x] 5.3 Step: validate file, set `processing_status = processing`
- [x] 5.4 Step: generate `thumb.webp` and `pages/page-{n}.webp` (sharp + pdftoppm)
- [x] 5.5 Step: insert `document_pages` rows; update `page_count`, `thumbnail_storage_path`
- [x] 5.6 Step: extract `ocr/fulltext.txt` via pdftotext for digital PDFs
- [x] 5.7 Step: run structured biomarker extraction (port `extractBiomarkers.ts` logic; LLM on text + page images for scans)
- [x] 5.8 Step: write `document_extracted_biomarkers` with `status = needs_review`, `processing_version`, `extraction_model`, `source_page`, `source_text`, `confidence`
- [x] 5.9 Step: set `processing_status = needs_review` or `failed`; set `processed_at`
- [x] 5.10 Document worker deploy instructions in README (Railway/Fly/Render)

## 6. Extraction review APIs and UI (PR3)

- [x] 6.1 Add `GET /api/documents/[id]/biomarkers` — list `document_extracted_biomarkers`
- [x] 6.2 Add `POST /api/documents/[id]/biomarkers/accept` — accept ids, upsert `observations` with `source_extracted_biomarker_id`
- [x] 6.3 Document detail right panel (pipeline mode): extracted biomarkers list with confidence, status, source_text
- [x] 6.4 Accept selected / accept UI actions; refresh observations after accept
- [x] 6.5 Click biomarker → navigate to `source_page`, show `source_text` (no bbox highlight)
- [x] 6.6 Dual-mode panel: legacy shows `observations`; pipeline shows extracted + accept controls

## 7. Polish and deferred (PR4 — optional follow-up)

- [x] 7.1 Add `POST /api/documents/[id]/reprocess` — enqueue new `full_pipeline` job
- [x] 7.2 Reprocess button on document detail for legacy and failed documents
- [x] 7.3 Health Profile: "Open source" link from observation to `/app/documents/[id]` with page param
- [x] 7.4 Client polling for `processing_status` while document is processing
- [x] 7.5 `DELETE /api/documents/[id]` with storage artifact cleanup (if not already present)

## 8. Verification

- [x] 8.1 Manual test: legacy completed doc opens original + shows observations
- [x] 8.2 Manual test: new upload → processing → needs_review → accept → observation with `source_extracted_biomarker_id`
- [x] 8.3 Manual test: download original works; viewing does not trigger x402
- [x] 8.4 Typecheck passes (`pnpm typecheck`)
