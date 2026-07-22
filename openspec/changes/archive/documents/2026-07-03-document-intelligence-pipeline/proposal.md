## Why

EasyHealth stores uploaded lab documents in private Supabase Storage but provides no way to open them in-app. Extraction runs synchronously in the upload API route, auto-writes biomarkers directly to `observations` without review or source provenance, and cannot scale beyond short PDF/image jobs. Users need a production-grade document experience: secure in-app preview, download, and biomarkers shown alongside the source document—with human review before values enter the health profile.

## What Changes

- Add in-app document viewer at `/app/documents/[id]` with side-by-side layout: page previews (left) and biomarkers panel (right).
- Add secure file access APIs using Supabase signed URLs (original, thumbnail, page previews); viewing is free (no x402).
- Add download original action for authenticated document owners.
- **BREAKING**: New uploads enqueue async processing instead of blocking on sync LLM extraction and auto-upsert to `observations`.
- Add background worker (Docker/Node) for thumbnails, page previews, text extraction, and structured biomarker extraction.
- Add `document_extracted_biomarkers` staging table; all new extractions start as `needs_review`; accept flow writes to `observations` with `source_extracted_biomarker_id`.
- Add extraction metadata (`processing_version`, `extraction_model`) on extraction records.
- Legacy strategy B: existing completed documents open via original signed URL and show existing `observations` on the right; reprocess action deferred to a later phase.
- Primary viewer uses generated WebP page previews; full PDF available via iframe/download fallback only.
- No Google Document AI / AWS Textract in v1; no bounding-box highlight until OCR coordinates exist.
- Extend documents list with thumbnails, processing status, and clickable rows.

## Capabilities

### New Capabilities

- `document-viewer`: In-app viewing, signed URL APIs, download, legacy dual-mode UX, page-preview-first display, PDF fallback.
- `document-processing`: Async job queue, worker pipeline, storage artifacts (thumb, pages, OCR text), processing status lifecycle.
- `document-extraction-review`: Staging extracted biomarkers, review/accept/reject, provenance linking to observations, extraction metadata.
- `document-upload-async`: Paid upload saves file and enqueues pipeline; stops auto-upserting observations.

### Modified Capabilities

- _(none — no existing OpenSpec capability specs in `openspec/specs/`)_

## Impact

- **Database**: New migrations for `document_pages`, `document_processing_jobs`, `document_extracted_biomarkers`; extend `documents` and `observations` tables.
- **API**: New routes under `/api/documents/[id]/…` (file, thumbnail, pages, biomarkers, accept); modify `POST /api/upload` behavior.
- **Storage**: New artifact paths under `{profileId}/{documentId}/` for new uploads; legacy flat paths remain readable.
- **Worker**: New `worker/` package (Docker) with sharp, poppler-utils; deployed separately from Next.js (Railway/Fly/Render).
- **Frontend**: New document detail page, updated documents list, biomarker review panel; optional deps (`react-zoom-pan-pinch` for preview pan/zoom).
- **Dependencies**: Worker adds sharp, poppler (system); no Document AI/Textract SDKs in v1.
- **Product**: Upload UX shifts from immediate result to async processing with progress states; medical disclaimer and EN-only UI preserved.
