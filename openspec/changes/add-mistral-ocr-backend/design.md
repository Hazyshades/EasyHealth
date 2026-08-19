## Context

The document worker currently downloads a private Supabase object, renders pages with Poppler, uses Poppler text only when a text layer is available, and otherwise sends page 1 to the existing vision extractor. Page rows and OCR objects are written under stable document paths before the processing attempt completes; reprocessing deletes the current page/evidence set first. Laboratory rows already carry retained processing-attempt and Registry 2.0 lifecycle data, while typed notes, prescriptions, referrals, and page rows do not have a publication boundary.

EH-163 must add an external OCR transcription adapter without changing the downstream document parsers or the Registry resolver. The external boundary handles health data, so the worker must use a regional, stateless, in-memory request and expose only privacy-safe operational metadata. Existing EH-118/EH-162 source-region rules remain authoritative: Mistral structure boxes are not exact clinical row geometry.

## Goals / Non-Goals

**Goals:**

- Route scans, images, and incomplete PDFs through one complete-document Mistral OCR request when explicitly enabled.
- Keep complete digital PDFs on the Poppler text/geometry path.
- Normalize OCR into EasyHealth-owned types and page-marked text with one-based internal pages.
- Make OCR artifacts and extracted evidence attempt-scoped, hidden until successful completion, and atomically promoted with the processing attempt.
- Persist source-text origin and OCR identity independently from the downstream extraction model.
- Keep Mistral-origin evidence in human review and require OCR identity in release/corpus hashes.
- Fail closed on invalid response, page mismatch, privacy configuration, and production provider failure.
- Provide deterministic unit, pipeline, database, retry, and corpus-contract evidence using synthetic or de-identified inputs.

**Non-Goals:**

- Replacing Registry 2.0 resolution, measurement identity, automatic verification policy, or Health Profile eligibility.
- Using Mistral annotations, Files, Libraries, Batch, public URLs, or a global endpoint for patient documents.
- Producing exact source overlays from coarse OCR blocks in v1.
- Automatically backfilling existing documents or enabling Mistral as a profile chat/synthesis provider.
- Making privacy/DPA approval implicit in code or claiming real-medical-data readiness without named operational evidence.

## Decisions

### 1. Provider-neutral OCR boundary

Add `worker/src/ocr/types.ts`, `worker/src/ocr/mistral.ts`, and `worker/src/ocr/select.ts`. `OcrDocument` owns provider, engine/model, source SHA-256, one-based pages, Markdown/plain text, dimensions, confidence, coarse blocks, and page usage. `pipeline.ts` consumes only this contract and never imports Mistral SDK types.

The Mistral adapter constructs one `Mistral` client for the selected `eu` or `us` regional server and calls `/v1/ocr` with an in-memory Base64 data URL (`document_url` for PDFs and `image_url` for images). It sets block confidence output, disables returned image Base64/header/footer expansion, validates the untrusted response with a local schema, and maps SDK/network failures to stable privacy-safe codes. No public URL or Files API path exists in the worker.

**Alternative rejected:** sending a public signed URL or uploading to Files/Batch. Those paths expand retention/deletion and data-residency risk for special-category data.

### 2. Deterministic selection and fail-closed fallback

`select.ts` receives MIME, rendered page count, Poppler page index, complete page-marked text, and configuration. It selects Poppler only when page counts agree, every non-blank rendered page has usable local text, and the complete text exceeds the existing extraction threshold. Otherwise it selects one complete Mistral request for PDFs/images. When disabled, scans/images retain an explicit development-only legacy-vision/unavailable result; production never silently completes from page 1. Routine dual-engine shadowing is not part of the production path.

Mistral page indexes are normalized by validated response array order and checked against the rendered page count. Missing, duplicate, out-of-range, or mismatched pages raise `ocr_page_mismatch`.

### 3. Provenance-safe artifacts

Extend `PageOcrArtifact` to schema v2 while keeping the v1 parser readable. v2 records provider, engine, model, source hash, one-based page, full text, Markdown, dimensions, normalized coarse blocks, coordinate origin, and creation time. Absolute block coordinates are normalized only when dimensions and finite non-negative coordinates are valid; invalid/inverted/out-of-page boxes are rejected. Table blocks are stored as coarse metadata and never become an exact biomarker region. Mistral pages feed the existing text parsers and page-only source index, so EH-162 draws no unsupported overlay.

Attempt artifacts use immutable paths under `profile/document/attempts/<processingAttemptId>/...`. Existing stable paths and schema-v1 artifacts remain readable. The successful completion payload points `documents.thumbnail_storage_path` and current page rows to the new attempt paths.

### 4. Atomic publication boundary

Add a migration that extends `document_pages`, typed extraction tables, and laboratory extraction rows with attempt/publication metadata as appropriate. New page, clinical-note, prescription, referral, and laboratory rows are inserted as staged (`is_current=false` for pages; `is_published=false` for extracted evidence) and carry the processing attempt. Legacy rows default to the current/published state.

Add a service-only completion trigger/helper on `document_processing_attempts`: on a successful transition, validate the staged page set against the completed page count, retire the prior current page set and typed evidence, then publish the staged set in the same transaction. On failure/requeue/reclaim, staged rows remain non-current/non-published and the prior current set is untouched. EH-120 continues to own laboratory lifecycle supersession; the new publication flag prevents staged laboratory rows from leaking before completion. Automatic verification runs only after publication and is best-effort for already-approved non-Mistral releases; Mistral-origin rows are skipped until the release gate allows them.

All user/API/Registry read boundaries filter current/published rows. Existing instrumental publication remains the authoritative transaction for instrumental measures; the page publication trigger runs on its attempt completion, so it covers both generic and instrumental finalizers without duplicating the large finalizer RPC.

**Alternative rejected:** delete current `document_pages` and child rows before processing. That is the existing failure window and can erase the only reviewable result when OCR or extraction fails.

### 5. OCR identity and review gate

Persist `source_text_origin` (`pdf_text_layer`, `mistral_ocr`, `vision_model`), OCR provider/model/adapter version, artifact schema version, and processing attempt on laboratory evidence. Include these identities in the extraction input evidence hash when present. Automatic verification checks source origin and remains denied for unapproved Mistral-origin rows; OCR confidence is never mapping confidence. The downstream extraction model remains the existing profile-selected provider.

### 6. Privacy-safe telemetry and startup checks

Extend service-only invocation telemetry with stage `ocr`, provider/model/region, processing attempt, input bytes, page count, latency, stable error code, request ID when supplied by the SDK, and estimated page cost. The OCR logger accepts only typed safe fields and never stores request/response content. SDK errors are mapped before they reach `processing_error`.

`worker/src/env.ts` validates Mistral settings only when enabled: API key, model, `eu|us` region, positive timeout/byte/page limits, and production failure mode `fail`. `ensureWorkerAiReady` verifies the selected model through `models.list` against the selected regional client and never retries against global. The default remains disabled.

### 7. Verification surfaces

Add focused worker scripts for response/selection/artifact/privacy contracts, a disposable pgTAP test for staged publication and rollback/privilege invariants, pipeline regression fixtures for digital/scanned/image/multi-page cases, and `QA/eh-163/checklist.md`. Add package scripts and CI coverage entries using existing repository conventions. Run required Registry documentation generation/drift/Wiki commands because the change alters extraction/resolution provenance and release inputs; record remote publication/issue status explicitly.

## Risks / Trade-offs

- Mistral response shapes and SDK request-option types can change; the local schema and adapter seam absorb that risk, and SDK upgrades require contract tests.
- A coarse Mistral block can look visually plausible. The v1 decision to persist it but force page-only provenance sacrifices overlay precision to avoid a false clinical claim.
- Staged evidence adds rows and storage objects after failed attempts. This is intentional auditability; lifecycle cleanup must remain separate from publication and must never delete the prior current set.
- The existing generic invocation table was designed for token telemetry, so OCR-specific nullable columns are added rather than storing JSON payloads or raw errors.
- ZDR, regional inference, training opt-out, and DPA approval cannot be proved by source code alone. The rollout stays disabled and the QA/issue handoff remains blocked until named operational evidence exists.
- Automatic verification is moved after publication for non-Mistral rows; a verification failure leaves the published extraction in review instead of failing a now-completed attempt, preventing a terminal-attempt transition conflict.
