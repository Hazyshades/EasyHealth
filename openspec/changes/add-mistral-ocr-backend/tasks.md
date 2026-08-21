## 1. Foundation and configuration

- [x] 1.1 Add `@mistralai/mistralai` to the worker dependency manifests and keep the worker lockfile reproducible.
- [x] 1.2 Add validated worker-only Mistral settings, production failure-mode rules, byte/page limits, timeout, and startup regional `models.list` verification.
- [x] 1.3 Add the provider-neutral OCR types, stable error codes, source-origin enum, and deterministic OCR selection policy.

## 2. Mistral adapter and artifacts

- [x] 2.1 Implement the stateless Base64 PDF/image Mistral adapter with timeout, bounded retry, local response validation, and SDK/network error redaction.
- [x] 2.2 Normalize response pages, dimensions, block confidence, coordinates, usage, model identity, and 0-based-to-1-based page numbering; reject invalid/page-mismatched results.
- [x] 2.3 Add Page OCR artifact schema v2 with schema-v1 compatibility and immutable attempt-scoped storage path helpers.
- [x] 2.4 Add unit/contract coverage for request MIME/data URLs, parsing, geometry, page normalization, error mapping, and the no-public-URL/Files/Batch boundary.

## 3. Atomic worker persistence

- [x] 3.1 Add the EH-163 migration for attempt/publication metadata on pages and typed extraction rows, laboratory OCR origin/identity fields, staged-row constraints, completion promotion, and failed-attempt preservation.
- [x] 3.2 Update service-role grants/RLS and document/page/extraction read boundaries to expose only current/published evidence while retaining historical attempt rows.
- [x] 3.3 Refactor worker page, OCR, thumbnail, typed extraction, and biomarker writes to stage under the processing attempt without deleting the prior current set.
- [x] 3.4 Promote OCR/page/typed evidence atomically with generic and instrumental completion, keep EH-120 laboratory supersession authoritative, and move automatic verification after publication with Mistral-origin denial.
- [x] 3.5 Add disposable pgTAP coverage for staged publication, rollback/failure preservation, page-set completeness, lifecycle constraints, service-only access, and retry/reclaim coherence.

## 4. Provenance, release identity, and telemetry

- [x] 4.1 Route normalized Mistral text through every existing classifier/document-type parser and persist source-text origin, OCR identity, downstream extraction model, and processing-attempt provenance.
- [x] 4.2 Preserve Poppler exact geometry, force Mistral coarse/table geometry to page-only provenance, and add source-region regression coverage for no false exact overlays.
- [x] 4.3 Bind OCR provider/model/adapter/artifact identities into extraction/corpus input hashes and keep unapproved Mistral rows out of automatic verification and Health Profile admission.
- [x] 4.4 Add privacy-safe `ocr` invocation telemetry and selection/failure/review cost counters without raw request/response content or raw provider errors.

## 5. Regression, QA, and release evidence

- [x] 5.1 Verify the worker/pipeline regression across the existing document set; the product owner explicitly accepts owner-attested regression evidence without adding a separate repository fixture artifact.
- [x] 5.2 Add `QA/eh-163/checklist.md` with synthetic/de-identified UI checks, unavailable-interface notes, developer evidence, privacy launch gates, and unexecuted-result placeholders.
- [x] 5.3 Update canonical Registry/biomarker documentation where affected, regenerate/check/test docs and Wiki staging, and create or update the single Registry tracking issue with publication status.
- [x] 5.4 Run focused worker/database/Registry tests, typecheck/build/smoke checks, strict OpenSpec validation, and record blockers/evidence in the QA checklist and EH-163 issue.
