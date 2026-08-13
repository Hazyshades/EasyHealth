## Why

EH-104 and EH-112 already separate resolver outcomes from verification and preserve incomplete laboratory evidence. EH-119 and EH-121 add append-only correction and change-history primitives, while EH-122 delivers the narrow batch-verification API. The remaining workflow still lacks one explicit record-lifecycle model for rejection/supersession and has no production path that activates the existing `auto_verified` contract, so users and downstream consumers cannot distinguish an unresolved result, a pending raw record, a verified measurement, and a retired record consistently.

EH-120 is needed before EH-123 so assessment invalidation and recalculation can consume stable, auditable transitions instead of inferring lifecycle from `verification_status`, extraction status, or projection side effects.

## What Changes

- Define one three-axis workflow contract:
  - `resolution_status`: `resolved | partial | ambiguous | unmapped`;
  - `verification_status`: `pending | auto_verified | user_verified | manually_corrected`;
  - `record_status`: `active | rejected | superseded`.
- Keep `rejected` and `superseded` out of `verification_status`; lifecycle state must not be inferred from resolver confidence or verification actor metadata.
- Define and enforce allowed transitions, actor/permission requirements, decision reasons, CAS/idempotency behavior, and terminal-state rules for acceptance, manual correction, reversal, rejection, supersession, and reprocessing.
- Add an auditable record rejection/supersession workflow that preserves raw evidence, prior revisions, source lineage, and EH-121 history instead of deleting or overwriting decisions.
- Activate automatic verification only for the existing deterministic, reviewed, source-safe resolver contract, with system decision metadata; partial, ambiguous, unmapped, stale, or non-reviewed results remain unverified raw evidence.
- Preserve the existing individual acceptance/correction/reversal paths and the EH-122 batch operation, idempotency, partial outcomes, and audit-safe undo. EH-120 must consume the delivered batch contract rather than create a second batch API.
- Make reprocessing and manual-decision outcomes explicit in the same state machine, including protection for active human decisions and retryable failures.
- Expose lifecycle and verification state, action availability, and safe reason labels in document review without changing Health Profile scoring eligibility: only active, resolved, reviewed, compatible bindings remain definition-specific consumer inputs.
- Add regression, database, API, and manual QA evidence for every resolver outcome, transition guard, rejection/supersession path, automatic verification, retry, and audit invariant.

## Capabilities

### New Capabilities

- `observation-verification-workflow`: authoritative transition state machine, record rejection/supersession, automatic verification activation, actor/reason/permission rules, reprocessing outcomes, and audit semantics across the document review workflow.

### Modified Capabilities

- `observation-resolution-verification`: extend the existing EH-104 contract with the runtime transition rules and production automatic-verification path while retaining database guards, source ownership, CAS, and reviewed-definition requirements.
- `document-extraction-review`: expose lifecycle-aware review actions and state labels for raw acceptance, verification, correction, rejection, supersession, reversal, and reprocessing without removing incomplete-result retention.

## Impact

- **Domain:** `documents`, with read-only downstream effects in `health-profile` and assessment consumers.
- **Database:** additive lifecycle fields/constraints, transition RPCs or trusted service procedures, audit event kinds, grants/RLS, and regression fixtures. Existing normalization revisions and `observation_change_events` remain append-only sources of decision history.
- **Server:** normalization policy/writer, document review routes, reprocessing service, batch-verification integration, authorization, and transition error contracts.
- **UI:** document viewer and review-row controls must render state-specific actions, permission/decision-reason requirements, safe incomplete-result wording, and audit/retry outcomes.
- **Worker:** reprocessing and automatic-verification runtime must use the same state contract and must not overwrite active human decisions.
- **Documentation and QA:** update the relevant canonical resolver/review documentation, generated Registry/Wiki surfaces when their public semantics change, `QA/eh-120/checklist.md`, and delivery evidence for issue #20.
- **Dependencies:** EH-104 and EH-112 are foundational; EH-119, EH-121, and delivered EH-122 behavior must remain compatible. EH-123 consumes the resulting lifecycle events and versioned state.