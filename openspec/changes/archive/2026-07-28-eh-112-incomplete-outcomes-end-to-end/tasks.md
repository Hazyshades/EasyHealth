## 1. Documents Outcome Contract

- [x] 1.1 Add shared four-outcome, resolution-details, consumer-eligibility, exclusion-reason, and metric-event types.
- [x] 1.2 Implement the authoritative active-revision outcome projector with a preview-only fallback for unaccepted extracted rows.
- [x] 1.3 Sanitize persisted decision evidence into missing axes, conflict/support reason codes, candidate count, and version metadata without exposing candidate identity.
- [x] 1.4 Extend document detail and document-observation reads with persisted confidence/evidence/version fields and serialize the shared `resolution_details` contract.
- [x] 1.5 Preserve raw result/provenance fields for all outcomes and keep incomplete concrete identity fields null.

## 2. Documents Review Experience

- [x] 2.1 Replace review labels and guidance with the EH-112 English wording for resolved, partial, ambiguous, and unmapped states.
- [x] 2.2 Replace candidate-key technical details with sanitized confidence, missing-context, reason, candidate-count, verification, and version details.
- [x] 2.3 Keep **Reprocess document** visible for documents with incomplete current rows and preserve the existing full-document request contract without candidate overrides.
- [x] 2.4 Update observation-fallback rows to use the same outcome wording and raw-result-first presentation.

## 3. Health-Profile and Downstream Safety

- [x] 3.1 Derive explicit trend, conversion, report, structured-context, and assessment eligibility plus stable exclusion reasons from the shared projector.
- [x] 3.2 Migrate Biomarkers API/page/table/chart selection to the shared eligibility contract while keeping incomplete rows list-visible.
- [x] 3.3 Migrate Health Profile assessment inputs to `assessmentEligible` and reviewed compatible assessment bindings.
- [x] 3.4 Migrate report and structured-context laboratory consumers to the shared eligibility contract and preserve raw document evidence separately.

## 4. Privacy-Safe Observability

- [x] 4.1 Implement a pure allowlisted `resolution_outcome` metric builder with deterministic sorted dimensions and no patient-linked or candidate-key fields.
- [x] 4.2 Emit one metric after each successful new normalization revision and suppress emission for idempotently reused writes.

## 5. Regression Evidence and QA

- [x] 5.1 Add a deterministic EH-112 verifier for resolved, partial, ambiguous, and unmapped serialization, nullable identity, sanitized details, and raw-evidence preservation.
- [x] 5.2 Add trend, conversion, report/structured-context, assessment, reprocess-contract, and metric allowlist negative cases.
- [x] 5.3 Add the EH-112 package script and run typecheck plus EH-106, EH-111, document-review, Biomarkers, and EH-112 regression gates.
- [x] 5.4 Create `QA/eh-112/checklist.md` with manual product scenarios, safe fixtures, developer evidence, and explicit EH-115/EH-116 exclusions.
