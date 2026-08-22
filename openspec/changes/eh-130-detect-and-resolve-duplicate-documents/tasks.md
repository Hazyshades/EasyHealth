## 1. Documents database foundation

- [x] 1.1 Add the EH-130 migration with document SHA-256/archive columns, canonical same-profile candidate and audit tables, indexes, RLS/service-role policies, and immutable audit protection.
- [x] 1.2 Implement deterministic metadata normalization/scoring, canonical candidate upsert, detection audit capture, and document insert/metadata-update trigger execution.
- [x] 1.3 Implement the service-only idempotent candidate-resolution RPC for keep-both and one-sided safe archive decisions with ownership and conflict guards.

## 2. Detection and server contracts

- [x] 2.1 Add the pure duplicate-detection TypeScript helper with filename normalization, weighted score/reason calculation, decision validation, and response types.
- [x] 2.2 Persist the upload hash and include the worker's existing source hash in document completion so new and reprocessed documents trigger database detection.
- [x] 2.3 Add owner-scoped duplicate candidate loading and include pending candidates in the document bootstrap response without exposing raw storage paths or cross-profile rows.
- [x] 2.4 Add the authenticated duplicate resolution API route with stable validation, ownership, conflict, and retry responses.

## 3. Active-source archive boundaries

- [x] 3.1 Exclude archived documents from owner document access/listing and prevent archived rows from being reprocessed or mutated through active document paths.
- [x] 3.2 Exclude archived source documents from the timeline, Health Profile snapshot, report eligibility, structured context, and Biomarkers projections while retaining their database and Storage data.

## 4. Duplicate review interface

- [x] 4.1 Build the accessible inline duplicate-candidate review component with exact/metadata evidence, document summaries, keep-both action, archive confirmation, loading, error, and resolved states.
- [x] 4.2 Wire the component into the document viewer bootstrap and navigation flow, including returning to Documents when the current document is archived.

## 5. Verification and roadmap QA

- [x] 5.1 Add deterministic EH-130 verification coverage for hash/scoring boundaries, candidate decisions, route contracts, archive filters, worker/upload wiring, and viewer controls.
- [x] 5.2 Add the synthetic EH-130 database contract fixture and `test:eh130-db` package script covering canonical candidates, profile isolation, safe archive, audit immutability, and idempotent resolution.
- [x] 5.3 Create `QA/eh-130/checklist.md` with tester-facing synthetic-data flows, developer evidence requirements, and explicit unavailable/deferred UI behavior.

## 6. Final verification

- [x] 6.1 Run the targeted EH-130 verification, database contract, typecheck, and production build; resolve any regressions before completion.
