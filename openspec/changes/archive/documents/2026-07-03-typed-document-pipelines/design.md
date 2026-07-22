## Context

EasyHealth has a working async document pipeline (`document-intelligence-pipeline`) for PDF/JPEG/PNG uploads: previews, biomarker staging (`document_extracted_biomarkers`), review/accept → `observations`, and a type-aware Documents hub with four tabs. Only `lab_result` (today `lab`) is functional end-to-end. `document_type` is a DB check constraint on four short enum values. Health Profile and `POST /api/reports` consume `observations` only.

Product direction (from exploration + `docs_classification.md`): separate **medical content type** (`document_type`) from **file format** (`file_kind`). Users explicitly choose type at upload. DICOM remains a separate future experience (UI tab only in this change).

## Goals / Non-Goals

**Goals:**

- Rename and migrate `document_type` to `lab_result`, `instrumental_report`, `consultation_note`; reserve `dicom` (no upload).
- Enable paid upload ($0.01) for the three active types with type-specific worker extraction and document-level summaries.
- Type-specific document viewer right panel (biomarkers + summary vs structured findings/notes + summary).
- Extend Health Profile with cached LLM **holistic synthesis** across all structured document data (labs + imaging + consultations).
- Extend paid reports ($0.05) to use multi-source context from selected documents.
- Preserve medical safety: educational language, source citations, mandatory disclaimer; document-stated diagnoses quoted, not generated.

**Non-Goals:**

- DICOM file upload, series storage, or slice viewer.
- Additional document types: discharge summary, prescription, referral (schema-ready via `document_subtype` nullable column only).
- Auto classification / type-mismatch detection at upload.
- Bounding-box highlight, Document AI/Textract.
- Changing x402 prices.
- Paid Health Profile refresh endpoint (synthesis refresh is free but rate-limited/cached).

## Decisions

### 1. Enum rename + migration

**Choice:** Migrate DB values: `lab`→`lab_result`, `imaging`→`instrumental_report`, `consultation`→`consultation_note`. Keep `dicom` in constraint for future use.

**Rationale:** Aligns with domain model in `docs_classification.md`; avoids ambiguous `imaging` (report vs raw images).

**Migration:** Single SQL migration updates check constraint and `UPDATE documents SET document_type = … WHERE …`. TypeScript `DocumentType` union and all API/UI references updated in same PR phase.

### 2. `file_kind` column

**Choice:** Add `file_kind text not null default 'unknown'` with check `('pdf','image','unknown')`. Set at upload from mime/extension.

**Rationale:** Prepares for DICOM without implementing it. No `dicom` value until upload is enabled.

### 3. User-selected type is source of truth

**Choice:** Upload form requires explicit `document_type`. Worker runs the pipeline for that type; no auto re-labeling in v1.

**Rationale:** Matches user intent; avoids misclassification UX. Wrong-type uploads may yield sparse extraction (acceptable).

### 4. Three extraction pipelines + shared preview path

**Choice:** Worker `runPipeline` keeps shared steps (download, previews, thumbnail, OCR text for PDF). After that, branch:

| `document_type`        | Extraction function              | Staging target                      |
|------------------------|----------------------------------|-------------------------------------|
| `lab_result`           | existing biomarker extraction    | `document_extracted_biomarkers`     |
| `instrumental_report`  | new instrumental schema          | `document_extracted_findings`       |
| `consultation_note`    | new clinical note schema         | `document_extracted_clinical_notes` |

All branches also produce `documents.document_summary` (short English educational summary, ≤3 sentences).

**Instrumental schema (Zod):** `modality`, `body_region`, `study_date`, `findings[]` (text + source_page), `impression` (verbatim-style quote field), `numeric_measures[]` (optional name/value/unit).

**Consultation schema (Zod):** `provider_name`, `visit_date`, `chief_complaint`, `history_summary`, `exam_findings`, `documented_diagnoses[]` (strings from document only), `recommendations[]`, `follow_up_plan`.

**Alternatives considered:** Single JSONB `extracted_payload` — rejected; harder to query and inconsistent with biomarker staging pattern.

### 5. Review flow by type

**Choice:**

- **Lab biomarkers:** unchanged — `needs_review`, user accept → `observations`.
- **Instrumental + consultation:** **auto-accept** — worker writes rows with `status = 'accepted'` immediately. No accept UI. User may **Reprocess** if extraction failed.

**Rationale:** Non-lab data does not feed numeric `observations`; review friction adds little safety vs biomarkers entering the health chart. Reduces MVP UI scope.

### 6. Document viewer right panel

**Choice:** Single viewer route; panel component switches on `document_type`:

- `lab_result`: biomarker list (review UI) + `document_summary` card.
- `instrumental_report`: findings list (modality, region, impression) + summary.
- `consultation_note`: structured sections + summary.
- Failed/processing: existing states.

### 7. Holistic Health Profile synthesis

**Choice:** Keep existing **deterministic** biomarker aggregation (`buildHealthProfile`) unchanged. Add optional section `holistic_synthesis` from new table `profile_health_synthesis`:

- Fields: `profile_id`, `synthesis_text`, `source_document_ids[]`, `generated_at`, `model`, `input_hash`.
- `GET /api/health-profile` returns deterministic data synchronously; if cache stale/missing and user has ≥1 document with structured data, trigger **async or inline** LLM generation (prefer inline with 15s timeout for MVP, fallback to "Generate synthesis" button if slow — implement button in tasks phase 2 if needed).
- Prompt includes: accepted biomarkers summary, instrumental findings, consultation notes — all with document filenames and dates. Output: educational cross-record narrative, no new diagnoses.

**MODIFIED product rule:** Free profile may show this one cached synthesis block; still no per-marker disease labels.

### 8. Multi-source reports

**Choice:** `POST /api/reports` builds context object:

```json
{
  "biomarkers": [...],
  "instrumental_findings": [...],
  "consultation_notes": [...],
  "document_summaries": [...]
}
```

Eligibility: document `processing_status` in (`ready`, `needs_review`, `completed`) AND has structured rows OR observations. **400 only if zero structured content** across scope (not only zero observations).

`abnormal_only` applies to biomarkers only; non-lab content always included when documents selected.

### 9. Upload UX

**Choice:**

- `/app/upload?type=lab_result|instrumental_report|consultation_note` — type-specific copy and `UploadZone`.
- Documents hub: each of the three tabs gets its own upload CTA.
- DICOM tab: unchanged "Coming soon", no upload link.

### 10. DICOM groundwork

**Choice:** No schema row type changes beyond reserved `dicom` enum and `file_kind` extensibility. Document in migration comment. UI tab label: "Medical images (DICOM)".

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| LLM cost/latency on health profile | Cache by `input_hash`; regenerate only when documents change |
| Health profile spec conflict (no free LLM) | Update spec: allow one educational synthesis block with disclaimer |
| User uploads consultation as lab | Sparse biomarkers; future: type hint on empty extraction |
| Owl Alpha / provider outages | Existing provider selection; document failure states |
| Consultation prompts leak diagnostic tone | System prompt: quote document only; server-side disclaimer |
| Scope creep | Phased tasks; DICOM upload explicitly deferred |

## Migration Plan

1. Deploy migration renaming `document_type` + new columns/tables (backward-compatible reads: map old values in API layer during deploy window if needed).
2. Deploy worker with branching (old workers finish queued lab jobs).
3. Deploy Next.js API + UI.
4. Optional: one-time reprocess not required for legacy `lab` docs.

Rollback: revert app/worker; migration rollback script restores old enum values if no new types inserted.

## Open Questions

- Rate limit for free synthesis refresh (e.g. once per hour per profile) — default: regenerate only when `input_hash` changes.
- Whether instrumental `numeric_measures` should eventually map to `observations` — deferred; display-only in v1.

## Deferred (explicitly out of this change)

- DICOM upload and viewer
- Discharge / prescription / referral document types
- Auto type validation (LLM mismatch warning)
- Type-specific x402 pricing
- Synthesis in multiple languages
