## 1. Freshness policy and readiness

- [x] 1.1 Add the versioned Health Profile freshness policy module with explicit per-system windows and deterministic calendar-date evaluation.
- [x] 1.2 Make Health Profile observation/input and marker date fields nullable, preserve source-date provenance, and select unknown-date identities deterministically without upload-date fallback.
- [x] 1.3 Attach freshness status to markers and make readiness exclude outdated/unknown-date candidates while exposing separate missing, outdated, unknown-date, and reference-range reasons.
- [x] 1.4 Include freshness policy version and evaluation metadata in the Health Profile result while preserving the existing strict null-score and data-confidence contracts.

## 2. Assessment version persistence and API

- [x] 2.1 Extend canonical Health Profile snapshot hashing and worker snapshot generation with policy version and evaluation date.
- [x] 2.2 Add the EH-144 assessment-version migration, default/backfill policy identity, and completion-RPC argument/storage contract without weakening append-only protections.
- [x] 2.3 Update the assessment worker and Health Profile API to pass, select, and expose the persisted freshness policy version and evaluation metadata.

## 3. Health Profile presentation

- [x] 3.1 Update Health Profile drawer and marker copy to distinguish outdated, unknown-date, missing, and unusable-reference states without test-order prompts or diagnostic language.
- [x] 3.2 Render nullable observed dates safely across the body map, system details, source records, and accessibility labels while keeping unavailable scores visibly null rather than zero.

## 4. Verification and delivery evidence

- [x] 4.1 Add pure EH-144 freshness/readiness regression coverage for policy boundaries, unknown dates, deterministic selection, score exclusion, version hashing, and no-order wording.
- [x] 4.2 Add the EH-144 pgTAP assessment-version migration/RPC contract and update EH-123/Health Profile projection regressions for the new version field.
- [x] 4.3 Register focused scripts in package, CI suite-coverage policy, and workflow database/verify jobs; run targeted typecheck and smoke verification.
- [x] 4.4 Update or confirm canonical Health Profile/biomarker documentation, regenerate required Registry docs and Wiki staging, record publication status, and create/update the matching documentation tracking issue.
- [x] 4.5 Create `QA/eh-144/checklist.md` with executable synthetic-data UI cases, blocked-interface notes, and developer evidence references; record only executed results.
