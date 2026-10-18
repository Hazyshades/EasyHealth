## 1. Persist review mode state

- [x] 1.1 Add `review_mode_default` to profile storage, `ProfileRow`, profile select mapping, and the authenticated profile API.
- [x] 1.2 Add the laboratory Document `review_mode` and `review_mode_locked_at` columns with constraints and compatibility defaults.
- [x] 1.3 Backfill existing laboratory Documents to Pro and lock Documents that already have accepted or manually corrected active revisions.
- [x] 1.4 Add nullable `review_mode_at_write` metadata to normalization revisions and update generated database types or local row types.
- [x] 1.5 Update `create_document_upload_reservation` to snapshot the profile default for new `lab_result` Documents while leaving non-laboratory Documents outside the policy.

## 2. Define and enforce the server policy

- [x] 2.1 Implement a shared Document review mode policy helper for normalized laboratory Documents, ownership, lock state, initial-write state, and allowed transitions.
- [x] 2.2 Add the authenticated mode selection and Easy-to-Pro escalation route with conditional updates, explicit confirmation, and stable conflict responses.
- [x] 2.3 Extend the Document bootstrap payload with effective mode, lock timestamp, and mode action availability.
- [x] 2.4 Enforce Easy action restrictions in acceptance, rejection, correction, manual mapping, batch verification, batch reversal, confirm-observations, and reprocess paths.
- [x] 2.5 Make the first accepted or manually corrected write lock the Document atomically with its normalization revision and observation projection.
- [x] 2.6 Thread the effective review mode through owner-driven acceptance, correction, mapping, and verification revision writes without changing Resolver input or raw evidence.
- [x] 2.7 Preserve the Document mode and lock state across full reprocess and extraction supersession.

## 3. Add profile and Document review controls

- [x] 3.1 Add the review mode default control to `/app/settings` with clear Easy and Pro descriptions, persistence feedback, keyboard focus, and narrow-screen reflow.
- [x] 3.2 Add mode state and optimistic conflict recovery to `DocumentViewer` and its bootstrap types.
- [x] 3.3 Render the Easy laboratory surface with read-only extracted evidence, provenance, confidence, explicit acceptance, and explicit rejection.
- [x] 3.4 Remove correction, manual mapping, batch verification, and correction undo controls from Easy while retaining the current Pro surface.
- [x] 3.5 Add pre-acceptance mode switching and the locked Easy `Enter Pro mode` escalation flow without losing review rows or history.
- [x] 3.6 Make mode, lock, denial, and stale-state messages accessible without color-only communication or horizontal overflow.

## 4. Verify behavior and compatibility

- [x] 4.1 Add focused policy and state-transition tests for profile defaults, pre-acceptance switching, rejection without lock, initial locking, escalation, and forbidden reverse transitions.
- [x] 4.2 Add authenticated route coverage for Easy acceptance and rejection, denied correction and verification mutations, ownership checks, stale mode conflicts, and Pro compatibility.
- [x] 4.3 Add database or RPC coverage proving atomic first-write locking, append-only Easy-to-Pro history, raw-field preservation, and concurrent conflict behavior.
- [x] 4.4 Add a review-surface smoke path covering Settings, Easy acceptance, Easy rejection, Pro escalation, Pro correction, and reprocess mode preservation.
- [x] 4.5 Run the existing targeted document, normalization, lifecycle, and UI checks without changing unrelated Registry or Health Profile expectations.

## 5. Complete documentation and release gates

- [x] 5.1 Update affected canonical Registry and biomarker documentation for review-mode revision metadata and persistence behavior.
- [x] 5.2 Run biomarker documentation generation, consistency, and test commands and review the generated output.
- [x] 5.3 Render and locally stage the Wiki mirror, confirm remote publication or record the exact pending blocker, and update one matching tracking issue.
- [x] 5.4 Record manual QA coverage under the roadmap checklist convention when this change receives an EH roadmap identifier. (Not applicable: no EH roadmap identifier is assigned to this change.)
