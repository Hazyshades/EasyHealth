## Why

EasyHealth currently falls back to first-page vision extraction for scanned PDFs and image-based medical documents. That path can silently lose pages and source provenance; EH-163 adds a provider-neutral Mistral OCR adapter without allowing an OCR vendor to become a clinical resolver or bypass review, Registry 2.0, or Health Profile gates.

## What Changes

- Add a worker-only, opt-in Mistral OCR backend using the official TypeScript SDK and stateless Base64 requests to an approved regional endpoint.
- Add deterministic OCR selection: retain Poppler for complete digital-PDF text layers and use Mistral once for scans, incomplete PDFs, and images.
- Normalize Mistral pages, blocks, dimensions, confidence, and errors into EasyHealth-owned contracts; preserve schema-v1 OCR artifacts and add schema-v2 artifacts.
- Persist attempt-scoped immutable OCR/page/extraction evidence and atomically promote a complete replacement, preserving the prior current result on failure.
- Persist OCR origin/provider/model/adapter metadata separately from the downstream extraction model; bind those identities into resolver/release evidence and keep Mistral-origin rows human-review-only until an approved release exists.
- Add privacy-safe OCR telemetry, stable error mapping, bounded timeout/retry behavior, de-identified regression/corpus checks, database contracts, and the EH-163 QA checklist.
- Block real medical-document traffic until regional inference, Zero Data Retention, training controls, and legal/DPA approval are evidenced; no Files API, Batch, Libraries, public URLs, or global fallback.

## Capabilities

### New Capabilities

- `mistral-ocr-backend`: Provider-neutral OCR selection, Mistral transcription, provenance-safe artifacts, privacy-safe telemetry, and atomic worker publication for scans and images.

### Modified Capabilities

- `release-gate-integrity`: Candidate/release input identity also binds the OCR provider, resolved model, adapter version, and OCR artifact schema so OCR changes require renewed approval.

## Impact

- **Target domain:** documents, with release-gate-integrity as the Registry 2.0 approval boundary.
- **Affected code:** `worker/src`, OCR artifact/source-region contracts, document processing migrations/RPCs, document read boundaries, and worker/test scripts.
- **Operational gate:** `MISTRAL_OCR_ENABLED` remains false by default; deployment verification must prove the selected regional model catalog and privacy controls before enabling it for real documents.
- **Compatibility:** existing Poppler processing and schema-v1 page OCR artifacts remain readable; no existing LLM provider setting is repurposed.
