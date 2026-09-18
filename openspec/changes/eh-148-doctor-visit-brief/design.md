# Design: eh-148-doctor-visit-brief

## Context

`reports.content` currently stores free-form doctor-summary sections. The generator receives structured rows, but `src/lib/reports.ts` projects most source identity down to a filename and the API persists `document_ids = null` when all eligible documents are selected. The detail page therefore cannot distinguish an evidence-backed claim from generated prose, and later sharing/export cannot enforce the original scope.

The change is the shared seam for EH-149, EH-150, EH-151, and EH-153. It must be small enough for callers to consume without duplicating report parsing or source authorization.

## Goals / Non-Goals

**Goals:**

- Define one versioned report/evidence DTO for generation, validation, rendering, sharing, and export.
- Preserve profile-scoped source identity and an immutable generation scope for every new report.
- Make factual claims carry stable evidence references and make missing evidence visible as a limitation.
- Keep the Doctor Visit Brief concise, educational, and free of diagnosis or treatment instructions.
- Make legacy reports readable without pretending that legacy filenames are citations.

**Non-Goals:**

- Clinical correctness, diagnosis, treatment selection, or a new medical triage policy.
- Share-token implementation, citation validation policy, biomarker dynamics calculations, or export rendering; those are separate changes.
- Reprocessing old reports or backfilling evidence that was not persisted.

## Decisions

### 1. Use a versioned deep report contract

Add `src/lib/report-contract.ts` as the only public boundary for report content. The contract contains:

- `schema_version` and `report_kind`.
- `generated_at`, `detail_level`, and the materialized `source_document_ids` represented by the existing `reports.document_ids` column for new rows.
- `sections` containing typed items rather than arrays of unqualified strings.
- `claims[]`, each with `id`, `section`, `kind` (`source_fact`, `numeric_observation`, or `clinician_question`), `origin` (`generated` or `user_selected` for questions), `citations[]`, `factual`, and `status` (`supported`, `limited`, or `removed`). Factual input claims carry no model-authored `text`; they carry `template_id` and closed `template_params`. The normalized contract adds server-rendered `text` only after EH-148's renderer runs. A `clinician_question` carries only non-factual `question_text`, has no factual template, and is rendered as a question whether it came from the user or model.
- `sources[]`, each with an internal `source_id`, `kind`, `document_id`, observed/recorded date when available, and a display-safe snapshot of the value, unit, range, or text.
- `limitations[]` and the mandatory educational disclaimer.
- `extensions.biomarker_dynamics`, when requested, containing the frozen EH-149 `BiomarkerDynamicsReport`, its schema/policy versions, selected period, and generation metadata. EH-149 supplies this server-side extension; the report persistence transition stores it as part of the validated payload so owner/share/export reads never accept a client DTO.
- `validation`, an immutable envelope with `status` (`valid` or `limited` for publishable reports), `version` returned unchanged by EH-150 (new reports use `eh150.v1`; read/share/export accepts only EH-150's recognized compatibility set), and `issue_codes[]` drawn only from the EH-150 code list. Invalid candidates are never persisted; legacy rows have a missing envelope. Issue codes contain no source text, health values, tokens, or profile identifiers.
- `overview`, a server-rendered, deterministic summary derived from validated typed claims/sections; it is not an independent model fact field and is the only source for `summary_preview`.

The report-generation request may include a bounded `questions` array and an optional inclusive UTC `report_date_range: { start, end }`, in addition to `biomarker_dynamics_period`. Each question is trimmed/NFC-normalized, must contain 1–240 Unicode scalar characters, must contain no control characters or line breaks, and the array contains at most five unique questions. The server stores accepted user questions as `clinician_question` claims with `origin: user_selected`; they are never treated as factual claims or answered by inserting model-authored factual text. `start` and `end` are inclusive UTC dates with `start <= end`; the server validates the range and applies it to the authoritative source/document date before resolving the immutable scope. The request never accepts client DTOs or raw observations.

A `ReportEvidenceRef` points only to a `source_id` in the same payload and carries the document UUID needed for scope checks. It never contains a storage path or an authorization decision. The public DTO omits profile IDs and bearer credentials. Each persisted report also has server-only `report_evidence_sources` rows keyed by `(report_id, source_id)` and mapping to `source_kind`, `source_row_id`, and `document_id`; EH-150 resolves citations through that mapping rather than treating a snapshot as row identity.

The source kinds are `observation`, `finding`, `clinical_note`, `prescription`, `referral`, and `document_summary`. EH-148's closed template catalog contains `source_fact_snapshot` with `{ source_id, include_date }` and `numeric_observation_snapshot` with `{ source_id, include_range }`; both parameters must reference cited sources and the renderer reads only source snapshots. The schema permits only non-factual `clinician_question` items without a citation; `source_fact` and `numeric_observation` claims require one approved template and at least one citation before they can be `supported`.

### 2. Materialize scope at generation time

`POST /api/reports` resolves eligible documents once, applies the requested selection, optional `report_date_range`, and existing `abnormal_only` policy, and delegates to the service-only `createValidatedReport` transition. With a date range, source eligibility uses the source's authoritative date: observation date for measurements and document date for findings, notes, prescriptions, referrals, and document summaries; undated sources are excluded. A document enters the materialized scope only when it contributes at least one eligible in-range source (or an in-range document-summary source). An explicitly supplied `document_ids` entry that is unauthorized, has no authoritative in-range source, or is outside the date range returns a safe validation error rather than widening or silently changing the requested scope; the all-eligible case includes only documents with an eligible in-range source. The service runs EH-150's pure validator against the server-authorized source catalog and immutable document scope; when `biomarker_dynamics_period` is present, it passes the exact `source_document_ids` scope plus the period to EH-149, whose comparison snapshot excludes candidates from other documents. The transition then calls the EH-148-owned `public.create_validated_report` RPC defined in the report-persistence migration. The RPC accepts only service-generated content, scope, source mappings, an optional scope-checked dynamics extension, and the validation envelope; it rechecks profile ownership, source-row identity, scope, and claim relationships inside the transaction.

The report-persistence migration adds nullable legacy-compatible columns `validation_status text`, `validation_version text`, and `validation_issue_codes text[]` to `reports`. New RPC writes require `validation_status` `valid` or `limited`, a non-empty `validation_version`, and issue codes from EH-150's stable list; `invalid` candidates are rejected before insertion. `report-read.ts` maps these columns into the immutable public `validation` envelope, and EH-151/EH-153 consume that projection rather than choosing their own fields.

The migration revokes `EXECUTE` on `public.create_validated_report` from `anon`, `authenticated`, and `public`, and grants it only to the service role. The RPC never trusts a client-supplied profile or scope without re-resolving ownership and source identity inside the function.

The persisted JSON contains the source snapshots used to render the report. The `report_evidence_sources` rows are written in the same transaction as the report, cascade with report deletion, and are not exposed in public DTOs. A later archive or deletion can disable a live source link without changing the historical text already shown. No source snapshot is used to authorize a new document download.

The `public.create_validated_report` RPC is the only writer for a new structured report and its evidence mapping. The route never performs a direct report insert followed by a separate validator or mapping write.

### 3. Keep source projection server-owned

Extend `src/lib/reports.ts` and `src/lib/documents/structured-context.ts` so each observation, finding, note, prescription, referral, and document summary retains its database row ID and document ID. `src/lib/report-evidence.ts` converts those rows into the contract's source catalog. The LLM receives the source catalog with opaque source IDs; it may cite only those IDs. Filenames remain display labels, never citation identity.

The parser rejects unknown source IDs and malformed claim objects before persistence. EH-150 supplies the reusable full validator; EH-148 keeps the structural parser and contract version check at the generation boundary.

`src/lib/report-safety-policy.ts` is the EH-148-owned deterministic safety stage: it accepts only the claim kinds and approved templates above, strips/rejects prohibited diagnosis/treatment/urgency/imperative keys, and prevents free-form factual model text from reaching persistence. Its machine limitation codes are part of the EH-150 validation result.

### 4. Render a source ledger, not inline citation prose

`ReportBody` renders typed sections and a source ledger grouped by document. Each claim shows its citation labels and can reveal the date/value/range snapshot. A missing or limited claim shows the associated limitation. The UI does not create links from a filename alone and does not expose raw storage paths.

`src/lib/report-read.ts` is the EH-148-owned server read resolver for owner detail, EH-151 public reports, and EH-153 exports. It loads the persisted report, validation envelope, `report_evidence_sources`, and current source rows within the immutable scope. For a legacy row identified by a missing contract version or null scope, it returns a `legacy` owner presentation that remains readable but explicitly disables sharing/export; EH-151/EH-153 reject that result generically. For a new structured row, it rejects a missing, invalid, unknown-code, or tampered validation envelope and dynamics extensions whose point/document identity is outside that scope. It marks affected claims `limited`, adds a `SOURCE_UNAVAILABLE` limitation when an observation/finding/note/prescription/referral/document is archived or deleted, preserves the historical snapshot for display, denies live/raw-source access, and returns the derived read status without rewriting `reports.content`.

### 5. Keep the generator deterministic at the boundary

The prompt asks for structured claim kinds, closed template IDs/parameters, source IDs, and the bounded user-selected question set, but the server owns normalization and safety: duplicate source references are collapsed, unknown IDs are rejected, the closed template renderer reads only cited source snapshots, and the disclaimer is injected by code. User-selected and generated questions remain non-factual question claims; a question is never converted into a factual answer field. Factual input never supplies renderable text. Removed claims are omitted from the persisted/public claim list; machine issue codes and limitations carry no model prose, and every renderer/exporter filters defensively by `status`. The parser rejects diagnosis, treatment, urgency, imperative, or free-form factual fields; only `clinician_question` may retain `question_text`, and it is rendered as a question rather than a report fact. The generator cannot use a date-range or question input to widen the server-authorized source catalog.

### 6. Ownership and handoffs

The file-level ownership matrix is recorded in `ownership.md` in this change. EH-148 owns `report-contract.ts`, source projection, report persistence and detail integration. EH-150 owns the validator module and returns a stable validation result; EH-148 owns the generation-route integration point. EH-149 owns biomarker dynamics projection, EH-151 owns public share verification, EH-152 owns share management UI, and EH-153 owns export adapters. No parallel branch edits another branch's owner files; cross-cutting changes are handed off through the contract.

## Risks / Trade-offs

- Persisted source snapshots increase report size. This is accepted because the snapshot is required for reproducible rendering and export; raw file bytes are never copied.
- Legacy rows cannot gain trustworthy citations without re-generation. They remain visible but are deliberately excluded from sharing/export rather than receiving guessed references.
- A citation proves source linkage, not clinical truth. The UI and disclaimer must state that limitation; EH-150 must not be described as a medical fact checker.
- Archiving a source after generation can make a source link unavailable while the report snapshot remains visible. The UI must show that limitation and deny any unauthorized storage access.
