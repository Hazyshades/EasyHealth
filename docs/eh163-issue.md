**Roadmap ID:** `EH-163`
**Sprint:** Backlog — schedule only after the privacy/compliance gate
**Epic:** Document intelligence / source provenance
**Priority:** P1 · **Story points:** 8 · **Risk:** High
**Functional owner:** Backend / Security & Privacy / Clinical Product
**Dependencies:** EH-118 (#18), EH-162 (#104)
**Related:** document-worker reliability (#83), Registry 2.0 provenance and verification (EH-103, EH-104, EH-120)

## Goal

Add Mistral Document AI OCR as a production-safe OCR backend for scanned PDFs and image-based medical documents, while preserving EasyHealth's existing immutable source evidence, page provenance, Registry 2.0 resolution, human review, and Health Profile eligibility boundaries.

Mistral OCR must improve transcription and multi-page/table structure. It must **not** become a second resolver, write clinical identities directly, or bypass the existing review and release gates.

## Why this belongs in the roadmap

The current worker is strong for digital PDFs but has a defined gap for scans and photographs:

```text
original document
  -> page previews
  -> pdftotext -bbox-layout
       -> usable text layer: page-marked text + exact local geometry
       -> no text layer: empty OCR text
            -> current fallback: vision extraction from page 1 only
```

Relevant current code:

- `worker/src/pipeline.ts` downloads the private Supabase object, generates previews, builds the page index, and routes text or image extraction.
- `worker/src/previews.ts` uses Poppler for digital-PDF text and word geometry.
- `worker/src/pipeline-llm.ts` uses text only when `ocrText.length > 80`; otherwise it sends the first page preview to a vision model.
- `src/lib/biomarkers/ocr-artifact.ts` already defines a versioned page OCR artifact.
- `src/lib/documents/source-region.ts` and EH-118/EH-162 render only persisted, page-coherent, exact provenance.
- `src/lib/documents/extraction.ts` parses laboratory rows, preserves raw values, and explicitly rejects unstated clinical axes.

The Mistral OCR Playground trial attached to this request is encouraging but is not a production benchmark: a synthetic two-page lab report was processed in about 3.09 s, produced 4,988 characters, and correctly exposed headings and table structure. The implementation still needs a de-identified corpus, API-level tests, privacy approval, and fail-closed provenance handling.

## Architecture decision

### Mistral OCR is an upstream transcription adapter

```text
private Supabase object
  -> worker buffer
  -> OCR selection
       -> digital PDF with complete text layer: existing Poppler path
       -> scan / image / incomplete text layer: Mistral /v1/ocr
  -> normalized page-marked OCR document
  -> existing classify + document-type extractor
  -> existing raw extraction tables
  -> existing Registry 2.0 resolver / verification lifecycle
  -> existing Health Profile admission gates
```

For v1:

- Use Mistral only for OCR transcription, layout, page metadata, confidence, and coarse blocks.
- Feed normalized page-marked Markdown/text into the existing `extract*FromText` functions.
- Keep `document_annotation` and `bbox_annotation` disabled. They must not write biomarkers, measurement definitions, resolver outcomes, or verification states.
- Keep the existing OpenAI/Nebius/etc. provider setting for classification, structured extraction, summaries, reports, and synthesis. OCR provider selection is a separate system concern, not a new value of `profiles.ai_provider`.
- Preserve Poppler as the preferred source of exact word geometry for digital PDFs.

This avoids a dangerous shortcut where one vendor response becomes both the transcription and the clinical interpretation.

## API integration

Use the official TypeScript SDK in the worker:

```bash
pnpm --dir worker add @mistralai/mistralai
```

Add `worker/src/ocr/mistral.ts` behind a small provider-neutral interface. The request should be stateless and should send the in-memory buffer as Base64; do not expose a public Supabase URL and do not upload patient documents to Mistral's Files API.

```ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: workerEnv.mistralApiKey,
  server: workerEnv.mistralRegion, // "eu" or "us"; no silent global fallback
});

const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
const document = mimeType === "application/pdf"
  ? { type: "document_url" as const, documentUrl: dataUrl }
  : { type: "image_url" as const, imageUrl: dataUrl };

const response = await client.ocr.process({
  model: workerEnv.mistralOcrModel,
  document,
  includeBlocks: true,
  includeImageBase64: false,
  confidenceScoresGranularity: "block",
  extractHeader: false,
  extractFooter: false,
});
```

The adapter must validate the response with a local schema and return an internal `OcrDocument`; no Mistral SDK types may leak into `pipeline.ts`.

Official API characteristics relevant here:

- Endpoint: `POST /v1/ocr` with `mistral-ocr-latest`.
- Inputs include document URL/file chunks and image URLs; the guide also supports Base64 PDF/image input.
- Output is page-oriented and includes Markdown, tables/images, dimensions, blocks, confidence scores, model, and usage information.
- `include_blocks` returns block-level bounding boxes in reading order.
- Page selection in the request is zero-based; EasyHealth page provenance is one-based, so the adapter must normalize by validated array order and test the conversion rather than trusting an undocumented assumption about response indices.
- Current published OCR 4.1 standard pricing is $4 per 1,000 pages; record page usage and verify pricing again before launch.

References:

- [OCR processor guide](https://docs.mistral.ai/studio/document-processing/basic_ocr)
- [OCR API reference](https://docs.mistral.ai/api/endpoint/ocr)
- [Document annotations](https://docs.mistral.ai/studio/document-processing/annotations)
- [Pricing](https://docs.mistral.ai/inference/pricing)

## Configuration

Add optional worker-only configuration:

```text
MISTRAL_API_KEY=
MISTRAL_OCR_ENABLED=false
MISTRAL_OCR_MODEL=mistral-ocr-latest
MISTRAL_OCR_REGION=eu             # eu | us; global prohibited for real health data
MISTRAL_OCR_TIMEOUT_MS=45000
MISTRAL_OCR_MAX_BYTES=<approved application limit>
MISTRAL_OCR_MAX_PAGES=<approved application limit>
MISTRAL_OCR_FAILURE_MODE=fail     # legacy_vision allowed only in local/dev
```

`MISTRAL_API_KEY` is required only when `MISTRAL_OCR_ENABLED=true`. Startup must fail clearly if OCR is enabled but the key, region, or model is invalid. Check `models.list` against the selected regional endpoint during deployment verification; never reroute automatically to the global endpoint.

## OCR selection policy

Implement `worker/src/ocr/select.ts` with deterministic, testable routing:

1. Image input -> Mistral OCR when enabled.
2. PDF -> keep the Poppler path only when:
   - the page-index page count matches the rendered preview page count;
   - every non-blank rendered page has usable local text; and
   - the complete page-marked text exceeds the existing minimum extraction threshold.
3. Otherwise -> run Mistral OCR once for the complete original PDF.
4. If Mistral is disabled for a scan/image -> retain the current explicit legacy behavior, but report that OCR coverage is unavailable.
5. If Mistral is enabled and fails in production -> fail the processing attempt with a stable privacy-safe code (`ocr_provider_unavailable`, `ocr_timeout`, `ocr_invalid_response`, `ocr_input_rejected`, or `ocr_page_mismatch`). Do not silently process only page 1 and mark a multi-page document complete.

Do not call both engines routinely in production. Shadow comparison is limited to de-identified fixtures and an explicitly enabled evaluation mode.

## Internal contract and artifact versioning

Introduce a provider-neutral contract such as:

```ts
type OcrDocument = {
  provider: "poppler" | "mistral";
  engine: string;
  model: string | null;
  sourceSha256: string;
  pages: Array<{
    pageNumber: number; // always 1-based inside EasyHealth
    markdown: string;
    plainText: string;
    width: number | null;
    height: number | null;
    averageConfidence: number | null;
    blocks: OcrBlock[];
  }>;
  usage: { pagesProcessed: number | null };
};
```

Add a backward-compatible `PageOcrArtifact` schema v2. Existing schema-v1 artifacts must remain readable.

```jsonc
{
  "schema_version": 2,
  "provider": "mistral",
  "engine": "mistral-ocr",
  "model": "mistral-ocr-latest",
  "source_sha256": "...",
  "page_number": 1,
  "full_text": "...",
  "markdown": "...",
  "blocks": [
    {
      "type": "text|title|list|table|image|...",
      "text": "...",
      "confidence": 0.98,
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.1 }
    }
  ],
  "coordinate_space": "normalized",
  "origin": "top-left",
  "created_at": "..."
}
```

Convert Mistral absolute block coordinates to normalized `[0,1]` coordinates using the returned page dimensions. Reject invalid, negative, inverted, out-of-page, missing-dimension, or page-mismatched boxes.

### Critical provenance boundary

Mistral block coordinates are coarse document-structure boxes. A detected `table` box is not proof of the exact row or cell that produced a biomarker.

- Never convert a whole-table box into an `exact` biomarker `bounding_box`.
- Table rows remain page-only unless the OCR response provides deterministic row/cell geometry and an exact unique snippet match under the existing source-region contract.
- Only geometry accepted by `parseSourceRegion` with an exact, page-coherent match may render in EH-162.
- Fuzzy, ambiguous, model-origin, whole-table, and low-confidence geometry must draw no overlay.
- Mistral OCR text is transcribed evidence, not identical to a native PDF text layer. Persist its origin explicitly.

Add `source_text_origin` (`pdf_text_layer | mistral_ocr | vision_model`) and OCR engine/model/confidence provenance to extracted laboratory evidence or its processing-attempt metadata. Propagate the origin without replacing the immutable raw value, unit, reference text, document ID, page, or processing release.

## Pipeline changes

Refactor the OCR portion of `worker/src/pipeline.ts` into these steps:

1. Download and hash the original private object.
2. Generate previews and determine page count.
3. Build the local Poppler page index.
4. Select local text or Mistral OCR through the policy above.
5. Validate that OCR pages are complete and coherent with preview pages.
6. Build `ocrText` using explicit `=== PAGE N ===` markers for every page.
7. Write immutable, attempt-scoped OCR artifacts.
8. Run the existing classifier and document-type extractor from the normalized text.
9. Persist extraction origin/version and complete the existing processing attempt.

Mistral output must flow through all existing document-type parsers (`lab_result`, instrumental report, consultation, discharge, prescription, referral), not through a laboratory-only side path.

### Atomicity and reprocessing

Do not overwrite the current OCR artifacts or delete current `document_pages` before the replacement OCR response and artifacts are complete.

- Store new artifacts under an immutable attempt-scoped or content-addressed prefix, for example `.../attempts/{processingAttemptId}/ocr/page-{n}.json`.
- Associate page rows with the processing attempt.
- Promote the new page set together with document completion, or preserve the prior current set when OCR/extraction/finalization fails.
- A retry for the same input/model/version must be recognizable by source hash and processing attempt; it must not create a mixed page set.

This closes the new external-call failure window without weakening the existing document-worker retry semantics.

## Automatic verification and Registry 2.0 safety

OCR quality is independent of resolver/catalog approval. The existing automatic-verification release gate must not automatically admit a new OCR engine.

- Include OCR provider, resolved model ID, adapter version, prompt/parameter version, and relevant artifact schema version in the extraction/corpus input hash.
- Until a Mistral-specific de-identified corpus approval exists, rows with `source_text_origin=mistral_ocr` must remain `needs_review` and must not call `writeAutomaticBiomarkerVerification`.
- Never infer specimen, method, timing, modifier, value kind, or unit from table position or typical clinical usage.
- OCR confidence is not mapping confidence and cannot make a Registry 2.0 candidate `resolved`.
- Partial, ambiguous, and unmapped results remain preserved but excluded from Health Profile scoring exactly as today.
- Bump `DOCUMENT_PROCESSING_VERSION` when the adapter is activated.

## Privacy and security launch gate

This is a hard prerequisite because source documents may contain health data and direct identifiers.

1. Keep the API key only in the worker secret store. Never expose it to Next.js client code or public environment variables.
2. Use Base64 with the stateless `/v1/ocr` endpoint. Do not use public URLs, `/v1/files`, Libraries, or Batch for patient documents.
3. Obtain and verify Mistral Zero Data Retention for the organization. Mistral documents `/v1/ocr` as ZDR-compatible, while `/v1/files` and Batch files are excluded.
4. Disable API training/data-improvement use in the organization privacy settings and verify it operationally.
5. Use the approved EU or US regional endpoint. Regional inference and ZDR are separate controls; enable both when required. No global fallback.
6. Complete legal/DPA review specifically for health/special-category data before processing real documents. The currently published DPA description lists special categories as `None`; do not assume the default text covers medical data.
7. Never log document bytes, Base64, OCR Markdown, patient identifiers, lab rows, or raw provider errors that echo content. Telemetry is limited to provider/model/region, page count, byte count, latency, success, privacy-safe error code, request ID, and estimated cost.
8. Redact SDK/network errors before storing them in `processing_error`.

References:

- [Mistral privacy and data controls](https://docs.mistral.ai/admin/monitor-comply/privacy-data-controls)
- [Mistral Zero Data Retention](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention)
- [Mistral regional inference](https://docs.mistral.ai/inference/regional-inference)
- [Mistral Data Processing Addendum](https://legal.mistral.ai/terms/data-processing-addendum)

## Observability and cost controls

Record one privacy-safe OCR invocation event per provider call, using the existing invocation telemetry where possible:

- stage `ocr`;
- provider `mistral`;
- requested alias and resolved response model;
- regional endpoint;
- input bytes and pages processed;
- latency;
- success and stable error code;
- Mistral request ID when available;
- processing attempt ID;
- estimated page cost.

Do not add raw request or response bodies. Add counters for OCR selection reason, local-vs-Mistral share, page mismatch, provider failures, and Mistral-to-review outcomes.

## Test plan

### Unit and contract tests

- Mistral response parsing, including missing/invalid fields.
- PDF vs image request construction and Base64 MIME handling.
- 0-based external / 1-based internal page normalization.
- block coordinate normalization, rotation/dimensions, and invalid-box rejection.
- table blocks never become exact row regions.
- deterministic OCR selection for digital PDF, partial text layer, scan, and image.
- stable privacy-safe error mapping for auth, 4xx, 429, timeout, 5xx, malformed JSON, and page mismatch.
- no public URL or Files API path exists in the worker.
- no OCR content enters logs or invocation telemetry.
- schema-v1 OCR artifacts remain readable; v2 round-trips.

### Pipeline regression

- Digital PDFs continue through Poppler and preserve current exact source overlays.
- A two-page scanned PDF sends the complete document once and extracts results from both pages.
- JPEG/PNG/AVIF input uses Mistral OCR, then the existing text extraction path.
- Every document type still reaches its current parser and persistence boundary.
- OCR failure does not publish a partial page set or erase the prior current artifacts.
- Worker retry/reclaim produces one coherent current result and auditable attempts.
- `source_text_origin=mistral_ocr` rows cannot auto-verify before OCR release approval.
- Registry candidate corpus retains `falseConcreteResolutions: 0`.

### De-identified quality corpus

Include clean digital PDFs, low-resolution scans, rotated pages, skew, photographs, mixed EN/RU/ES reports, multi-page reports, repeated values, qualitative values, decimal comma, inequality values, dual units, handwritten annotations, and dense tables.

Report separately:

- document/page completeness;
- row recall;
- exact raw label/value/unit/reference-range accuracy;
- page attribution accuracy;
- exact-region availability and false-overlay count;
- resolver state distribution;
- false concrete resolutions;
- p50/p95 latency, failure rate, pages, and cost.

No threshold may be approved from the single Playground sample. Production activation requires named approval of the corpus report, zero false concrete resolutions, zero false exact overlays, and explicit acceptance of any extraction regressions.

## Rollout

1. **Synthetic/dev:** implement the adapter and use only synthetic or fully de-identified fixtures.
2. **Shadow evaluation:** opt-in comparison on the approved corpus; no patient documents and no writes to active observations.
3. **Fallback canary:** enable only for scans/images with no usable local text; force human review; monitor latency/cost/error and quality metrics.
4. **General fallback:** expand after privacy, corpus, and operational approvals.
5. **Future decision:** evaluate Mistral document annotations as a replacement for the second structured-extraction call only in a separate change with equivalent clinical/provenance tests.

Rollback is configuration-only: disable `MISTRAL_OCR_ENABLED`; digital PDFs keep the Poppler path, and scan/image documents return the explicit OCR-unavailable state rather than silently publishing incomplete page-1 extraction.

## Implementation checklist

- [ ] Complete privacy/DPA/ZDR/regional-inference approval for medical data
- [ ] Add `@mistralai/mistralai` to `worker/package.json`
- [ ] Add optional validated Mistral worker configuration and startup checks
- [ ] Add provider-neutral OCR types, Mistral adapter, and deterministic selection policy
- [ ] Add timeout, bounded retry, response validation, and privacy-safe errors
- [ ] Add backward-compatible OCR artifact schema v2 and immutable attempt-scoped paths
- [ ] Preserve prior current page/OCR artifacts until successful promotion
- [ ] Normalize all internal page numbers to one-based
- [ ] Preserve Mistral blocks as coarse provenance; prohibit whole-table exact highlights
- [ ] Persist OCR provider/model/version/source origin separately from the downstream extraction model
- [ ] Route normalized OCR text through existing classifiers and document-type extractors
- [ ] Bind OCR engine/version into processing and corpus release hashes
- [ ] Disable automatic verification for unapproved Mistral-origin rows
- [ ] Add privacy-safe OCR invocation telemetry and cost metrics
- [ ] Add unit, pipeline, persistence, worker-retry, and corpus tests
- [ ] Add `QA/eh-163/checklist.md` with synthetic/de-identified evidence only
- [ ] Validate `pnpm typecheck`, `pnpm build`, document-worker tests, document persistence tests, EH-118/EH-162 tests, multilingual tests, and Registry 2.0 candidate-corpus gates

## Acceptance criteria

- A scanned or image-based multi-page report is transcribed by Mistral as a complete page-marked document and then processed by the existing EasyHealth extraction/review pipeline.
- Digital PDFs with a complete text layer keep the current Poppler text and exact geometry path.
- No Mistral response can directly create a measurement definition, resolver outcome, verified observation, or Health Profile contribution.
- Mistral-origin rows remain human-review-only until their OCR release is hash-bound and approved.
- Every persisted row retains document/page/source origin, OCR provider/model/version, downstream extraction model, and processing attempt provenance.
- Whole-table or otherwise coarse Mistral boxes never render as exact biomarker-row highlights; unsupported geometry degrades to page-only.
- A failed OCR/reprocess attempt cannot erase or mix the prior current page artifacts or extracted evidence.
- Real medical documents are blocked until the privacy/DPA, ZDR, regional inference, and training controls are verified.
- Logs and telemetry contain no document text, Base64, patient identifiers, or lab values.
- The de-identified corpus passes approved thresholds with `falseConcreteResolutions: 0` and zero false exact overlays.

## Non-goals

- Replacing Registry 2.0 or deterministic measurement resolution with an OCR/LLM answer.
- Automatically verifying Mistral-extracted biomarkers in the first release.
- Using Mistral Files, Libraries, Batch, or public document URLs for patient documents.
- Treating OCR confidence as clinical or mapping confidence.
- Rendering coarse table bounding boxes as exact row provenance.
- Changing Health Profile score eligibility, conversion, or assessment rules.
- Enabling Mistral as the user's general chat/synthesis provider.
- Backfilling existing documents automatically; reprocessing remains explicit and auditable.
