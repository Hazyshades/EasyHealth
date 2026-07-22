## Context

EasyHealth is a Next.js 15 App Router wellness PHR. Users pay $0.01 USDC via x402 to upload PDF/JPEG/PNG lab documents (max 10 MB). Files land in private Supabase bucket `lab-documents`; metadata lives in `documents`. Today `POST /api/upload` runs sync LLM extraction (`extractBiomarkersFromFile`) and auto-upserts into `observations` within a 60s serverless window. `/app/documents` lists metadata only—rows are not clickable and files cannot be opened.

This change introduces an async document intelligence pipeline with in-app viewing, staging/review for extracted biomarkers, and legacy compatibility for documents processed before the pipeline existed.

**Constraints (from product rules):**
- EN-first UI; educational language only; no diagnoses.
- Private storage + RLS; no PHI on-chain.
- x402 remains on upload only; viewing/download is free.
- DICOM out of scope.
- Minimize diff scope; match existing patterns.

## Goals / Non-Goals

**Goals:**

- In-app document viewer with download original (free, authenticated).
- Side-by-side UX: page previews left, biomarkers right.
- Async worker for previews + extraction; no heavy processing in Next.js routes or Edge Functions.
- Staging table `document_extracted_biomarkers` with `needs_review` default; accept writes to `observations` with provenance.
- Legacy strategy B: pre-pipeline completed docs open original file and show existing `observations`.
- Phased delivery across 4 PRs (viewer → schema/worker → extraction/review → polish).

**Non-Goals (v1):**

- Google Document AI / AWS Textract integration.
- Bounding-box highlight overlay on page previews.
- DICOM viewer.
- Public document sharing.
- Paid document viewing.
- Automatic reprocess of all legacy documents.
- `document_access_logs` table (deferred).
- Storage path migration for legacy flat layout (`{profileId}/{uuid}-{filename}`).

## Decisions

### 1. Page previews as primary viewer (not PDF.js)

**Choice:** Render `pages/page-N.webp` in the left panel; offer full PDF via signed URL in iframe or download.

**Rationale:** Faster first paint on mobile; consistent UX for PDF and images; avoids pdf.js worker complexity as the default path.

**Alternatives considered:**
- `@react-pdf-viewer` as primary — heavier bundle, slower on large PDFs; kept as optional iframe fallback only.

### 2. Legacy strategy B (dual mode)

**Choice:** Documents without pipeline artifacts (`processing_version` null or `legacy`) use `storage_path` / `original_storage_path` signed URL for viewing and load biomarkers from `observations` where `document_id` matches.

**Rationale:** Avoids mandatory backfill; ships viewer value immediately.

**Reprocess:** Deferred; UI may show disabled/coming-soon or omit until PR4.

### 3. Async upload — stop auto-upsert

**Choice:** After x402-paid upload, save original, insert `documents` row, enqueue `full_pipeline` job, return `documentId` + `processing` status. Remove `upsertObservations` from upload handler.

**Rationale:** Separates staging from health profile; enables review workflow.

**BREAKING:** Upload response no longer includes immediate `biomarkers` array; client redirects to documents list/detail with processing state.

### 4. All new extractions start as `needs_review`

**Choice:** Worker sets `document_extracted_biomarkers.status = 'needs_review'` for every row. No `auto_accepted` in v1.

**Rationale:** Health product safety; user explicitly accepts before profile update.

### 5. OCR v1 without cloud vendors

**Choice:** Worker uses poppler `pdftotext` for digital PDFs; scanned PDFs/images use existing Vercel AI SDK multimodal extraction on page WebP images. Store `ocr/fulltext.txt` per document; no layout JSON with coordinates in v1.

**Rationale:** No new vendor, GDPR/consent, or cost. Bounding boxes deferred until Document AI/Textract in a future change.

**Alternatives considered:**
- Tesseract — possible later fallback; not in v1 scope.

### 6. Worker hosting and job queue

**Choice:** Node.js Docker worker with Postgres polling on `document_processing_jobs` (`status = 'queued'`, `FOR UPDATE SKIP LOCKED` or equivalent lock pattern).

**Rationale:** Fits Supabase-only stack for hackathon/MVP; no Redis required.

**Deploy target:** Railway, Fly.io, or Render (operator choice at deploy time).

**Worker dependencies:** `sharp`, `poppler-utils` (pdftoppm, pdftotext), `@supabase/supabase-js`, existing extraction logic ported from `extract-biomarkers.ts`.

### 7. Storage layout for new uploads

**Choice:**

```text
lab-documents/{profileId}/{documentId}/original.{ext}
lab-documents/{profileId}/{documentId}/thumb.webp
lab-documents/{profileId}/{documentId}/pages/page-{n}.webp
lab-documents/{profileId}/{documentId}/ocr/fulltext.txt
lab-documents/{profileId}/{documentId}/extraction/biomarkers.json
```

Legacy files keep existing `storage_path`; `documents.original_storage_path` populated on read if null (backfill column from legacy `storage_path`).

### 8. Processing status — aggregate for UI

**Choice:** Worker tracks granular internal steps; API exposes simplified statuses:

| API `processing_status` | Meaning |
|-------------------------|---------|
| `processing` | queued or in progress (preview, OCR, extraction) |
| `needs_review` | pipeline done; extracted biomarkers await review |
| `ready` | all biomarkers accepted or none extracted |
| `failed` | pipeline error |

Map legacy `documents.status = 'completed'` without pipeline metadata to `ready` (legacy mode).

### 9. Extraction metadata

**Choice:** On `document_extracted_biomarkers` and/or `documents`:

- `processing_version` (text, e.g. `2026-06-30-v1`) — pipeline semver for reprocess compatibility.
- `extraction_model` (text) — model id used for LLM step.

Store on each extracted row and on `documents` for document-level audit.

### 10. Observations provenance

**Choice:** Add `observations.source_extracted_biomarker_id uuid references document_extracted_biomarkers(id)`.

Set only when user accepts via `POST /api/documents/[id]/biomarkers/accept`.

### 11. Signed URL API pattern

**Choice:** Server routes verify session + `profile_id` ownership, call `createSignedUrl(path, 900)`, return `{ url, mimeType, filename, expiresIn }` with `Cache-Control: no-store`. Never return raw `storage_path` to client.

### 12. Biomarker click behavior (v1)

**Choice:** Clicking a biomarker with `source_page` navigates to that page in the preview panel and shows `source_text` in a detail strip. No visual highlight overlay.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Upload UX feels slower (async) | Clear processing states on list/detail; poll or refresh status |
| Legacy vs new UX inconsistency | Explicit legacy badge; same layout (preview or original + observations) |
| Worker downtime blocks processing | Jobs remain queued; show failed/retry after max attempts |
| Scanned PDFs poor text from pdftotext | Fall back to LLM vision on page images |
| No bbox → weaker provenance UX | Show `source_text` + page number; highlight in future change |
| Docker worker ops burden | Document deploy in README; single-worker polling sufficient for MVP |
| Breaking upload API contract | Update `UploadZone` to handle async response |

## Migration Plan

1. **PR1 (viewer):** Migrations add `mime_type`, `file_size_bytes`, `original_storage_path` (nullable). APIs for signed URLs. Document detail page. Legacy docs work via existing `storage_path`. No worker yet.
2. **PR2 (pipeline skeleton):** Full schema migrations; worker generates thumb/pages; upload enqueues jobs; UI shows processing. Legacy uploads unchanged until re-upload.
3. **PR3 (extraction review):** Worker writes `document_extracted_biomarkers`; accept API; stop auto-upsert (if not already in PR2). Review UI.
4. **PR4 (polish):** Reprocess endpoint, optional access logs, Health Profile "Open source" links.

**Rollback:** Feature-flag async upload via env `DOCUMENT_ASYNC_PIPELINE=false` to temporarily restore sync path (optional safety valve during rollout).

## Open Questions

- Worker deploy target (Railway vs Fly vs Render) — decide at implementation.
- Polling interval for document status on client (5s vs 10s) — tune in PR2.
- Whether PR1 ships observations panel from `observations` only or waits for PR3 — **resolved: PR1 shows `observations` for legacy; PR3 adds extracted staging panel with accept actions.**
