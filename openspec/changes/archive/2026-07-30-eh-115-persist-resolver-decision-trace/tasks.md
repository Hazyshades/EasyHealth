## 1. Resolver trace contract

- [x] 1.1 Add versioned, allowlisted resolver-decision trace types, decision kinds, canonicalization, and strict validation beside the measurement resolver contracts.
- [x] 1.2 Build a deterministic trace from every resolver outcome, including candidate maturity and scores, evidence-code summaries, missing axes, conflicts, release versions, and the correct outcome rationale.
- [x] 1.3 Extend manual-correction resolution so its new revision produces a compatible `manual_selection` trace without mutating prior decisions.
- [x] 1.4 Add resolver-level regression cases for resolved, ambiguous, partial, unmapped, manual-selection, canonical-ordering, and raw-input redaction behavior.

## 2. Documents persistence boundary

- [x] 2.1 Add an additive Supabase migration for revision-owned trace columns, trace schema validation, creation-only immutability enforcement, and service-only RPC input validation.
- [x] 2.2 Extend the atomic normalization writer payload and request hash to build, validate, send, persist, and idempotently reuse the canonical trace in the existing transaction.
- [x] 2.3 Preserve EH-104/EH-106 CAS, promotion, ownership, active-revision, and incomplete-identity invariants while rejecting malformed or privacy-unsafe trace RPC payloads.
- [x] 2.4 Add database fixtures for each resolver outcome, retry reuse, manual correction history, immutability, malformed direct RPC input, and no partial write after validation failure.

## 3. Documents review contract and interface

- [x] 3.1 Extend normalization revision read models and the authenticated document biomarker query to return persisted trace data and explicit trace availability for active and historical revisions.
- [x] 3.2 Change normalization review projection logic to use the stored trace for any persisted revision, with a separately labelled non-persisted preview only when no revision exists and an unavailable state for legacy revisions.
- [x] 3.3 Update document technical details to render the recorded decision rationale, candidate evidence-code summaries, versions, missing axes, conflicts, and distinct preview or legacy-unavailable labels without raw-source content.
- [x] 3.4 Add document-review regression coverage proving historical trace stability after resolver change, authenticated ownership enforcement, preview labelling, and absence of raw document values from the API trace.

## 4. Change verification

- [x] 4.1 Run the focused resolver, document-review, atomic-writer, and Supabase database regression suites.
- [x] 4.2 Run TypeScript type checking and strict OpenSpec validation; record the executed evidence and any unavailable local dependency.