## Context

Phase 1 (`typed-document-pipelines`) delivered `lab_result`, `instrumental_report`, and `consultation_note` with user-selected routing, typed extraction, holistic synthesis (free, cache-based), and multi-source reports. Production testing with `UMNwriteup.pdf` (Sample H&P) uploaded as lab produced correct vital-sign numbers with wrong semantics — root cause: no auto-validation and a greedy lab prompt.

Deferred items from phase 1 design are prioritized here except **all DICOM work** (upload, viewer, metadata, `file_kind` dicom values), which remain explicitly excluded per product decision.

## Goals / Non-Goals

**Goals:**

- Warn users when uploaded content likely mismatches selected `document_type`; offer low-friction correction (reprocess with suggested type).
- Support `discharge_summary`, `prescription`, `referral` end-to-end (upload → worker → viewer).
- Surface instrumental numeric measures on the Health Profile chart via `observations`.
- Monetize holistic synthesis regeneration with x402 while keeping first synthesis free on cache miss.
- Tighten lab extraction to reduce vital-sign false positives.
- Refine consultation extraction (path A): rename diagnoses field, tighten prompt boundaries, improve exam vitals coverage in prose.

**Non-Goals:**

- DICOM upload, viewer, series storage, or `file_kind` dicom/dicom_series.
- `other` catch-all document type (defer).
- Type-specific x402 upload pricing.
- Batch re-tag of legacy misclassified documents (manual reprocess only).
- Bounding-box highlight, Document AI/Textract.
- Russian or other localization.
- Auto re-labeling without user confirmation.
- Full H&P structured schema (separate PMH, allergies, family history, vitals arrays) — path B deferred.

## Decisions

### 1. Type mismatch detection

**Choice:** After shared preview + OCR in the worker, run a **lightweight classification** LLM call (single JSON: `detected_type`, `confidence`, `reason`) before type-specific extraction. Store result on `documents` (`detected_document_type`, `type_mismatch_warning` boolean, `type_mismatch_reason` text). If `detected_type !== document_type` and `confidence >= 0.7`, set warning flag.

**Rationale:** Catches H&P-as-lab without blocking upload; user retains control. Classification uses same model provider as profile preference.

**UX:** Document viewer shows amber banner: "This looks like a consultation note, not a lab report." Actions: **Reprocess as consultation** (calls reprocess API with `document_type` override) or **Dismiss** (clears warning flag client-side or via PATCH).

**Alternatives considered:** Block upload at ingest — rejected (needs OCR first). Auto re-route silently — rejected (violates user-selected type principle from phase 1).

### 2. Lab extraction hardening

**Choice:** Update lab system prompt with explicit exclusions: vital signs (BP, pulse, respirations, temperature, SpO2), physical examination findings, and narrative clinical notes. Instruct model to return empty `biomarkers` when document is clearly not a laboratory report.

**Rationale:** Defense in depth when mismatch warning is ignored or dismissed.

### 3. Extended document types

**Choice:** Add three values to `document_type` constraint:

| Type | Extraction target | Auto-accept | Viewer panel |
|------|-------------------|-------------|--------------|
| `discharge_summary` | `document_extracted_clinical_notes` (discharge fields) | yes | discharge sections + summary |
| `prescription` | new `document_extracted_prescriptions` table | yes | medication list + summary |
| `referral` | new `document_extracted_referrals` table | yes | referral details + summary |

**Discharge schema** extends clinical note shape: `admission_date`, `discharge_date`, `hospital_course`, `discharge_diagnoses[]`, `discharge_medications[]`, `follow_up_instructions`.

**Prescription schema:** `prescriber_name`, `prescribed_at`, `medications[]` { `name`, `dose`, `frequency`, `duration`, `instructions` }.

**Referral schema:** `referring_provider`, `referred_to_specialty`, `referred_to_provider`, `referral_date`, `reason_for_referral`, `clinical_summary`, `urgency`.

**Rationale:** Separate tables keep queries simple vs one JSONB blob. Discharge reuses clinical_notes table with `note_kind = 'discharge'` column to avoid a fourth narrative table — **revised**: add `note_kind` enum on `document_extracted_clinical_notes` (`consultation` | `discharge`) instead of duplicate table.

**Upload:** `/app/upload?type=discharge_summary|prescription|referral`; Documents hub adds three tabs (or groups discharge under Consultations sub-filter — **choice: separate tabs** for clarity in hackathon demo).

### 4. Instrumental numeric measures → observations

**Choice:** When instrumental extraction returns `numeric_measures[]`, worker additionally inserts `observations` rows:

- `biomarker_key`: normalized snake_case from measure name
- `value`, `unit`, `observed_at` from study_date
- `source_document_id` linkage (existing column or metadata)
- `observation_kind = 'instrumental'` (new optional column or use `source` text field if exists)

Measures auto-accept (no review UI). Deduplicate by `profile_id + biomarker_key + observed_at + source_document_id`.

**Rationale:** Health Profile chart today is observation-driven; instrumental EF/LVEDD belong on timeline without manual accept.

**Scope limit:** Only explicitly extracted numeric measures; do not parse free-text findings into numbers.

### 5. Paid holistic synthesis refresh

**Choice:** New endpoint `POST /api/health-profile/synthesis` protected by x402 at **$0.02 USDC** (between upload and report; adjustable via env).

- First generation remains **free** when cache missing on `GET /api/health-profile` (unchanged phase 1 behavior).
- Paid refresh **forces** regeneration even if `input_hash` unchanged (user explicitly pays).
- Invalidates and replaces `profile_health_synthesis` row.
- Response: `{ synthesis_text, generated_at, payment_receipt }`.

**Rationale:** Monetizes repeat value without paywalling initial profile experience.

**UI:** Health Profile section "Holistic synthesis" with **Refresh synthesis ($0.02)** button when user has structured documents.

### 6. Reprocess with type override

**Choice:** Extend existing reprocess API/job to accept optional `document_type` in body. When provided, update `documents.document_type` before re-queuing job; clear mismatch flags; wipe prior extraction rows for old type.

**Rationale:** Single action from mismatch banner without re-upload and re-pay.

### 7. Multi-source reports inclusion

**Choice:** Reports API includes discharge notes, prescriptions, and referrals in context object (additive). No price change on `POST /api/reports`.

### 8. Consultation schema refinement (path A)

**Choice:** Rename `documented_diagnoses` → `documented_problems` in DB column, TypeScript types, API responses, and viewer. Update consultation system prompt:

- `documented_problems` SHALL include problem-list and assessment-style items **as written** in the document (e.g. "Chest pain with features of angina pectoris").
- **Exclude** from `documented_problems`: past medical history, surgical history, allergies, family history, and physical examination findings (those belong in `history_summary` or `exam_findings`).
- `exam_findings` SHALL include all vital signs when present (BP, pulse, respirations, temperature) plus pertinent exam narrative.
- Consultation `document_summary` prompt SHALL cite specific plan items when present rather than generic "monitoring for heart issues" phrasing.

**Rationale:** UMNwriteup (Sample H&P) testing showed ~85–90% extraction quality with correct routing but misleading "diagnoses" label and mixed problem-list content. Path A fixes semantics and prompt boundaries without new tables or vitals arrays.

**Alternatives considered:** Path B (split PMH/allergies/FH/vitals into separate fields) — deferred; higher fidelity but larger migration and UI scope.

**Migration:** `ALTER TABLE document_extracted_clinical_notes RENAME COLUMN documented_diagnoses TO documented_problems`; readers accept legacy key during transition if needed in application layer for one release (optional).

## Risks / Trade-offs

- **[Risk] Classification false positives** → Mitigation: confidence threshold 0.7; user can dismiss; never auto-change type.
- **[Risk] Instrumental measures pollute lab chart** → Mitigation: distinct `observation_kind`; UI legend "From imaging/functional study".
- **[Risk] Prescription table PHI sensitivity** → Mitigation: RLS unchanged; no on-chain PHI; educational summaries only.
- **[Risk] Six hub tabs crowded** → Mitigation: acceptable for hackathon; collapse later.
- **[Risk] Paid refresh underused** → Mitigation: show stale indicator when `input_hash` differs from current profile data.

## Migration Plan

1. SQL migration: extend `document_type` check; add mismatch columns on `documents`; add `note_kind` on clinical notes; rename `documented_diagnoses` → `documented_problems`; create `document_extracted_prescriptions`, `document_extracted_referrals`; add `observation_kind` on `observations` if not present.
2. Deploy worker with classification + new pipelines.
3. Deploy API + frontend.
4. No backfill required; optional manual reprocess for known bad uploads.

## Open Questions

- Final synthesis refresh price: $0.02 vs $0.05 — default $0.02 in env `X402_SYNTHESIS_PRICE`.
- Prescription upload: allow photo of pill bottle (image) — yes, same as other types.
- Whether discharge tab label is "Discharge" or "Hospital discharge" — use "Discharge summaries".
